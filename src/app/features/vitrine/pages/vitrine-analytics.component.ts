import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { VitrineTrackingService } from '../services/vitrine-tracking.service';

interface Stats {
  total: number;
  byType: { type: string; count: number }[];
  produtosMaisVistos: { productId: string; productName: string; count: number }[];
}

@Component({
  selector: 'app-vitrine-analytics',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gray-50 py-8">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold text-gray-900 mb-2">
            Analytics da Vitrine
          </h1>
          <p class="text-gray-600">
            Workspace: <span class="font-medium text-gray-900">{{ workspaceSlug }}</span>
          </p>
        </div>

        <!-- Período de Análise -->
        <div class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Período de Análise</h2>
          <div class="flex flex-wrap gap-3">
            @for (periodo of periodos; track periodo.dias) {
              <button
                (click)="selecionarPeriodo(periodo.dias)"
                [class.bg-gray-900]="diasSelecionados() === periodo.dias"
                [class.text-white]="diasSelecionados() === periodo.dias"
                [class.bg-gray-100]="diasSelecionados() !== periodo.dias"
                [class.text-gray-700]="diasSelecionados() !== periodo.dias"
                class="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
              >
                {{ periodo.label }}
              </button>
            }
          </div>
        </div>

        <!-- Cards de Resumo -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <!-- Total de Eventos -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-600">Total de Eventos</h3>
              <span class="text-2xl">📊</span>
            </div>
            <p class="text-3xl font-bold text-gray-900">{{ stats().total }}</p>
          </div>

          <!-- Visualizações -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-600">Visualizações</h3>
              <span class="text-2xl">👀</span>
            </div>
            <p class="text-3xl font-bold text-blue-600">{{ totalVisualizacoes() }}</p>
          </div>

          <!-- Cliques WhatsApp -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-600">Cliques WhatsApp</h3>
              <span class="text-2xl">💬</span>
            </div>
            <p class="text-3xl font-bold text-green-600">{{ totalWhatsApp() }}</p>
          </div>

          <!-- Taxa de Conversão -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-medium text-gray-600">Taxa de Conversão</h3>
              <span class="text-2xl">🎯</span>
            </div>
            <p class="text-3xl font-bold text-purple-600">{{ taxaConversao() }}%</p>
          </div>
        </div>

        <!-- Eventos por Tipo -->
        <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Eventos por Tipo</h2>
          @if (stats().byType.length > 0) {
            <div class="space-y-3">
              @for (item of stats().byType; track item.type) {
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div class="flex items-center gap-3">
                    <span class="text-2xl">{{ getEventEmoji(item.type) }}</span>
                    <div>
                      <p class="font-medium text-gray-900">{{ getEventLabel(item.type) }}</p>
                      <p class="text-sm text-gray-500">{{ item.type }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-2xl font-bold text-gray-900">{{ item.count }}</p>
                    <p class="text-sm text-gray-500">eventos</p>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="text-gray-500 text-center py-8">Nenhum evento registrado</p>
          }
        </div>

        <!-- Produtos Mais Vistos -->
        <div class="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Produtos Mais Vistos</h2>
          @if (stats().produtosMaisVistos.length > 0) {
            <div class="space-y-3">
              @for (produto of stats().produtosMaisVistos; track produto.productId; let i = $index) {
                <div class="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold text-sm">
                      {{ i + 1 }}
                    </div>
                    <div>
                      <p class="font-medium text-gray-900">{{ produto.productName }}</p>
                      <p class="text-sm text-gray-500">ID: {{ produto.productId }}</p>
                    </div>
                  </div>
                  <div class="text-right">
                    <p class="text-xl font-bold text-gray-900">{{ produto.count }}</p>
                    <p class="text-sm text-gray-500">visualizações</p>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="text-gray-500 text-center py-8">Nenhum produto visualizado</p>
          }
        </div>

        <!-- Ações -->
        <div class="bg-white rounded-lg shadow-sm p-6">
          <h2 class="text-lg font-semibold text-gray-900 mb-4">Ações</h2>
          <div class="flex flex-wrap gap-3">
            <button
              (click)="exportarDados()"
              class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Exportar JSON
            </button>

            <button
              (click)="limparDados()"
              class="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
              Limpar Todos os Dados
            </button>

            <button
              (click)="recarregar()"
              class="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
              </svg>
              Recarregar
            </button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class VitrineAnalyticsComponent implements OnInit {
  private trackingService = inject(VitrineTrackingService);
  private route = inject(ActivatedRoute);

  workspaceSlug = '';
  diasSelecionados = signal(7);
  stats = signal<Stats>({ total: 0, byType: [], produtosMaisVistos: [] });

  periodos = [
    { label: 'Hoje', dias: 1 },
    { label: '7 Dias', dias: 7 },
    { label: '15 Dias', dias: 15 },
    { label: '30 Dias', dias: 30 },
    { label: '90 Dias', dias: 90 }
  ];

  // Computed: Total de visualizações
  totalVisualizacoes = computed(() => {
    const item = this.stats().byType.find(t => t.type === 'produto_visualizado');
    return item?.count || 0;
  });

  // Computed: Total de cliques WhatsApp
  totalWhatsApp = computed(() => {
    const item = this.stats().byType.find(t => t.type === 'produto_whatsapp_click');
    return item?.count || 0;
  });

  // Computed: Taxa de conversão
  taxaConversao = computed(() => {
    const visualizacoes = this.totalVisualizacoes();
    const whatsapp = this.totalWhatsApp();
    
    if (visualizacoes === 0) return '0.00';
    
    return ((whatsapp / visualizacoes) * 100).toFixed(2);
  });

  ngOnInit(): void {
    this.workspaceSlug = this.route.snapshot.paramMap.get('workspaceSlug') || '';
    
    if (!this.workspaceSlug) {
      this.workspaceSlug = 'demo'; // Fallback para demo
    }

    this.carregarStats();
  }

  selecionarPeriodo(dias: number): void {
    this.diasSelecionados.set(dias);
    this.carregarStats();
  }

  carregarStats(): void {
    const dados = this.trackingService.getStats(this.workspaceSlug, this.diasSelecionados());
    this.stats.set(dados);
  }

  exportarDados(): void {
    const json = this.trackingService.export(this.workspaceSlug);
    
    // Criar blob e download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vitrine-analytics-${this.workspaceSlug}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  limparDados(): void {
    if (confirm('Tem certeza que deseja limpar TODOS os dados de tracking? Esta ação não pode ser desfeita.')) {
      this.trackingService.clear(this.workspaceSlug);
      this.carregarStats();
      alert('Dados limpos com sucesso!');
    }
  }

  recarregar(): void {
    this.carregarStats();
  }

  getEventEmoji(type: string): string {
    const emojis: Record<string, string> = {
      'home_aberto': '🏠',
      'catalogo_aberto': '📋',
      'produto_visualizado': '👀',
      'produto_whatsapp_click': '💬',
      'produto_favoritado': '❤️',
      'produto_desfavoritado': '💔',
      'busca_realizada': '🔍',
      'filtro_aplicado': '🔧'
    };
    return emojis[type] || '📊';
  }

  getEventLabel(type: string): string {
    const labels: Record<string, string> = {
      'home_aberto': 'Home Aberta',
      'catalogo_aberto': 'Catálogo Aberto',
      'produto_visualizado': 'Produto Visualizado',
      'produto_whatsapp_click': 'Clique no WhatsApp',
      'produto_favoritado': 'Produto Favoritado',
      'produto_desfavoritado': 'Produto Desfavoritado',
      'busca_realizada': 'Busca Realizada',
      'filtro_aplicado': 'Filtro Aplicado'
    };
    return labels[type] || type;
  }
}
