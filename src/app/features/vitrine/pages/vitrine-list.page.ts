import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VitrineService, Produto } from '../services/vitrine.service';
import { VitrineTrackingService } from '../services/vitrine-tracking.service';
import { ProductCardComponent } from '../components/product-card.component';
import { HeaderComponent } from '../components/header.component';

type SortOption = 'relevancia' | 'menor-preco' | 'maior-preco' | 'novidades' | 'mais-vendidos';

@Component({
  selector: 'app-vitrine-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductCardComponent, HeaderComponent],
  templateUrl: './vitrine-list.page.html',
  styleUrls: ['./vitrine-list.page.css']
})
export class VitrineListPage implements OnInit {
  private vitrineService = inject(VitrineService);
  private trackingService = inject(VitrineTrackingService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // State
  produtos = signal<Produto[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  workspaceSlug = '';

  // Filtros
  searchTerm = signal('');
  selectedCategory = signal<string>('all');
  selectedMaterial = signal<string>('all');
  selectedCollection = signal<string>('all');
  priceMin = signal<number | null>(null);
  priceMax = signal<number | null>(null);
  sortBy = signal<SortOption>('relevancia');

  // Mobile
  showFilters = signal(false);

  // Categorias disponíveis
  categories = ['all', 'ANEL', 'COLAR', 'BRINCO', 'PULSEIRA', 'CORRENTE', 'OUTRO'];
  materials = ['all', 'OURO', 'PRATA', 'ACO', 'PEROLA', 'FOLHEADO', 'OUTRO'];

  // Produtos filtrados e ordenados
  produtosFiltrados = computed(() => {
    let result = this.produtos();

    // Filtro de busca
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      result = result.filter(p => 
        p.nome.toLowerCase().includes(search) ||
        p.codigo.toLowerCase().includes(search)
      );
    }

    // Filtro de categoria
    if (this.selectedCategory() !== 'all') {
      result = result.filter(p => p.categoria === this.selectedCategory());
      
      // Registrar uso de filtro de categoria
      this.trackingService.track('filtro_aplicado', this.workspaceSlug, {
        meta: { tipo: 'categoria', valor: this.selectedCategory() }
      });
    }

    // Filtro de material
    if (this.selectedMaterial() !== 'all') {
      result = result.filter(p => p.material === this.selectedMaterial());
      
      // Registrar uso de filtro de material
      this.trackingService.track('filtro_aplicado', this.workspaceSlug, {
        meta: { tipo: 'material', valor: this.selectedMaterial() }
      });
    }

    // Filtro de coleção
    if (this.selectedCollection() !== 'all') {
      result = result.filter(p => (p as any).colecao === this.selectedCollection());
      
      // Registrar uso de filtro de coleção
      this.trackingService.track('filtro_aplicado', this.workspaceSlug, {
        meta: { tipo: 'colecao', valor: this.selectedCollection() }
      });
    }

    // Filtro de preço
    if (this.priceMin() !== null || this.priceMax() !== null) {
      if (this.priceMin() !== null) {
        result = result.filter(p => p.preco >= this.priceMin()!);
      }
      if (this.priceMax() !== null) {
        result = result.filter(p => p.preco <= this.priceMax()!);
      }
      
      // Registrar uso de filtro de preço
      this.trackingService.track('filtro_aplicado', this.workspaceSlug, {
        meta: { 
          tipo: 'preco', 
          min: this.priceMin() || 0, 
          max: this.priceMax() || 0 
        }
      });
    }

    // Ordenação
    const sortOption = this.sortBy();
    if (sortOption === 'menor-preco') {
      result = [...result].sort((a, b) => a.preco - b.preco);
    } else if (sortOption === 'maior-preco') {
      result = [...result].sort((a, b) => b.preco - a.preco);
    } else if (sortOption === 'novidades') {
      result = [...result].sort((a, b) => (b.novidade ? 1 : 0) - (a.novidade ? 1 : 0));
    } else if (sortOption === 'mais-vendidos') {
      result = [...result].sort((a, b) => (b.maisVendido ? 1 : 0) - (a.maisVendido ? 1 : 0));
    }

    return result;
  });

  ngOnInit(): void {
    this.workspaceSlug = this.route.snapshot.paramMap.get('workspaceSlug') || '';
    
    // Verificar query params para filtros
    this.route.queryParams.subscribe(params => {
      if (params['categoria']) {
        this.selectedCategory.set(params['categoria']);
      }
      if (params['material']) {
        this.selectedMaterial.set(params['material']);
      }
      if (params['colecao']) {
        this.selectedCollection.set(params['colecao']);
      }
    });

    if (this.workspaceSlug) {
      this.trackingService.track('catalogo_aberto', this.workspaceSlug);
      this.loadProducts();
    } else {
      this.error.set('Workspace não encontrado');
      this.loading.set(false);
    }
  }

  loadProducts(): void {
    this.loading.set(true);
    this.error.set(null);
    
    this.vitrineService.getProdutos(this.workspaceSlug).subscribe({
      next: (produtos) => {
        this.produtos.set(produtos);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erro ao carregar produtos:', err);
        this.error.set('Erro ao carregar produtos. Tente novamente.');
        this.loading.set(false);
      }
    });
  }

  viewProduct(produto: Produto): void {
    this.trackingService.track('produto_visualizado', this.workspaceSlug, {
      productId: produto.id,
      productName: produto.nome
    });
    this.router.navigate(['/vitrine', this.workspaceSlug, produto.id]);
  }

  shareOnWhatsApp(produto: Produto): void {
    this.trackingService.track('produto_whatsapp_click', this.workspaceSlug, {
      productId: produto.id,
      productName: produto.nome,
      meta: { origem: 'catalogo', preco: produto.preco }
    });

    const vitrineUrl = `${window.location.origin}/vitrine/${this.workspaceSlug}/${produto.id}`;
    this.vitrineService.chamarNoWhatsApp(produto, vitrineUrl);
  }

  onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (term) {
      this.trackingService.track('busca_realizada', this.workspaceSlug, {
        meta: { termo: term }
      });
    }
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedCategory.set('all');
    this.selectedMaterial.set('all');
    this.selectedCollection.set('all');
    this.priceMin.set(null);
    this.priceMax.set(null);
    this.sortBy.set('relevancia');
  }

  toggleFilters(): void {
    this.showFilters.set(!this.showFilters());
  }

  getCategoryLabel(value: string): string {
    const labels: Record<string, string> = {
      all: 'Todas as categorias',
      ANEL: 'Anéis',
      COLAR: 'Colares',
      BRINCO: 'Brincos',
      PULSEIRA: 'Pulseiras',
      CORRENTE: 'Correntes',
      OUTRO: 'Outros'
    };
    return labels[value] || value;
  }

  getMaterialLabel(value: string): string {
    const labels: Record<string, string> = {
      all: 'Todos os materiais',
      OURO: 'Ouro',
      PRATA: 'Prata',
      ACO: 'Aço',
      PEROLA: 'Pérola',
      FOLHEADO: 'Folheado',
      OUTRO: 'Outro'
    };
    return labels[value] || value;
  }

  abrirWhatsAppGeral(): void {
    const mensagem = 'Olá! Gostaria de saber mais sobre seus produtos.';
    const encodedMessage = encodeURIComponent(mensagem);
    const telefone = '5511963723387';
    window.open(`https://wa.me/${telefone}?text=${encodedMessage}`, '_blank');
  }
}
