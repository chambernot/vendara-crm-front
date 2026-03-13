import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { VitrineApiService, PublicProduct } from '../data-access';

@Component({
  selector: 'app-vitrine-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe],
  templateUrl: './vitrine-detail.page.html',
  styleUrls: ['./vitrine-detail.page.css']
})
export class VitrineDetailPage implements OnInit {
  product = signal<PublicProduct | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  currentImageIndex = signal(0);  // NOVO: índice da imagem atual
  workspaceSlug = '';
  productId = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private vitrineApi: VitrineApiService
  ) {}

  ngOnInit(): void {
    this.workspaceSlug = this.route.snapshot.paramMap.get('workspaceSlug') || '';
    this.productId = this.route.snapshot.paramMap.get('productId') || '';
    
    if (this.workspaceSlug && this.productId) {
      this.loadProduct();
    } else {
      this.error.set('Produto não encontrado');
      this.loading.set(false);
    }
  }

  loadProduct(): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentImageIndex.set(0);  // Reset imagem ao carregar
    
    this.vitrineApi.getPublicProduct(this.workspaceSlug, this.productId).subscribe({
      next: (product) => {
        this.product.set(product);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar produto:', err);
        this.error.set('Produto não encontrado');
        this.loading.set(false);
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/vitrine', this.workspaceSlug]);
  }

  contactOnWhatsApp(): void {
    const prod = this.product();
    if (!prod) return;

    const message = this.vitrineApi.generateWhatsAppMessage(
      prod,
      window.location.href
    );
    
    const encodedMessage = encodeURIComponent(message);
    // Telefone fixo de contato
    const contactPhone = '5511963723387';
    window.open(`https://wa.me/${contactPhone}?text=${encodedMessage}`, '_blank');
  }

  formatPrice(price: number): string {
    console.log('🔍 [Vitrine Detail] Formatando preço:', price, typeof price);
    if (price === null || price === undefined || isNaN(price)) {
      console.warn('⚠️ [Vitrine Detail] Preço inválido:', price);
      return 'R$ 0,00';
    }
    const formatted = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
    console.log('✅ [Vitrine Detail] Preço formatado:', formatted);
    return formatted;
  }

  getProductImage(product: PublicProduct): string {
    // Usa as imagens do novo sistema
    if (product.images && product.images.length > 0) {
      const currentImage = product.images[this.currentImageIndex()];
      return this.getFullImageUrl(currentImage.url);
    }
    
    // Fallback: photoUrl legado
    if (product.photoUrl) {
      return this.getFullImageUrl(product.photoUrl);
    }
    
    // Placeholder
    return 'https://via.placeholder.com/800x800?text=Sem+Foto';
  }

  /**
   * Retorna todas as imagens do produto (URLs completas)
   */
  getProductImages(product: PublicProduct): string[] {
    if (product.images && product.images.length > 0) {
      return product.images.map(img => this.getFullImageUrl(img.url));
    }
    
    if (product.photoUrl) {
      return [this.getFullImageUrl(product.photoUrl)];
    }
    
    return ['https://via.placeholder.com/800x800?text=Sem+Foto'];
  }

  private getFullImageUrl(relativePath: string): string {
    if (!relativePath) return 'https://via.placeholder.com/800x800?text=Sem+Foto';
    // Se já for URL completa, retorna direto
    if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
      return relativePath;
    }
    // Monta URL completa com baseUrl (sem /api)
    const baseUrl = this.vitrineApi['baseUrl'] || window.location.origin;
    return baseUrl + relativePath;
  }

  /**
   * Seleciona uma imagem específica para exibir
   */
  selectImage(index: number): void {
    this.currentImageIndex.set(index);
  }

  /**
   * Navega para a próxima imagem
   */
  nextImage(): void {
    const product = this.product();
    if (!product) return;
    
    const totalImages = this.getProductImages(product).length;
    const current = this.currentImageIndex();
    this.currentImageIndex.set((current + 1) % totalImages);
  }

  /**
   * Navega para a imagem anterior
   */
  previousImage(): void {
    const product = this.product();
    if (!product) return;
    
    const totalImages = this.getProductImages(product).length;
    const current = this.currentImageIndex();
    this.currentImageIndex.set(current === 0 ? totalImages - 1 : current - 1);
  }
}
