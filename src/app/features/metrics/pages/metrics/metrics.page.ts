import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TelemetryService, TelemetrySummary, TelemetryEvent } from '../../../../core/telemetry';
import { WorkspaceService } from '../../../../core/workspace';

@Component({
  selector: 'app-metrics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './metrics.page.html'
})
export class MetricsPage implements OnInit {
  private telemetryService = inject(TelemetryService);
  private workspaceService = inject(WorkspaceService);

  summary = signal<TelemetrySummary>({ total: 0, byType: [], lastEvents: [] });
  loading = signal(true);

  // Expose Object.keys for template
  Object = Object;

  ngOnInit(): void {
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.loading.set(true);
    try {
      const summary = this.telemetryService.getSummary(7);
      this.summary.set(summary);
    } catch (error) {
      console.error('Failed to load metrics:', error);
    } finally {
      this.loading.set(false);
    }
  }

  exportMetrics(): void {
    const exportData = this.telemetryService.exportEvents();
    if (!exportData) {
      alert('Erro ao exportar métricas');
      return;
    }

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const workspace = this.workspaceService.getActive();
    const date = new Date().toISOString().split('T')[0];
    const wsName = workspace ? workspace.name.toLowerCase().replace(/\s+/g, '-') : 'workspace';
    a.download = `vendara-telemetry-${wsName}-${date}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  clearMetrics(): void {
    if (confirm('Tem certeza que deseja limpar todos os eventos de telemetria? Esta ação não pode ser desfeita.')) {
      this.telemetryService.clear();
      this.loadMetrics();
      alert('✅ Métricas limpas com sucesso');
    }
  }

  formatDate(isoDate: string): string {
    return new Date(isoDate).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getEventLabel(type: string): string {
    const labels: Record<string, string> = {
      app_open: 'App aberto',
      login: 'Login',
      onboarding_complete: 'Onboarding concluído',
      workspace_selected: 'Workspace selecionado',
      client_created: 'Cliente criado',
      client_updated: 'Cliente atualizado',
      client_viewed: 'Cliente visualizado',
      product_created: 'Produto criado',
      product_status_changed: 'Status do produto alterado',
      product_viewed: 'Produto visualizado',
      consignation_created: 'Consignação criada',
      consignation_sold: 'Consignação vendida',
      consignation_returned: 'Consignação devolvida',
      central_open: 'Central aberta',
      template_copied: 'Template copiado',
      whatsapp_opened: 'WhatsApp aberto',
      export_done: 'Exportação realizada',
      import_done: 'Importação realizada'
    };
    return labels[type] || type;
  }

  getEventIcon(type: string): string {
    const icons: Record<string, string> = {
      app_open: '🚀',
      login: '🔐',
      onboarding_complete: '✅',
      workspace_selected: '💼',
      client_created: '👤',
      client_updated: '✏️',
      client_viewed: '👁️',
      product_created: '💍',
      product_status_changed: '🔄',
      product_viewed: '👁️',
      consignation_created: '📦',
      consignation_sold: '💰',
      consignation_returned: '↩️',
      central_open: '💬',
      template_copied: '📋',
      whatsapp_opened: '📱',
      export_done: '📤',
      import_done: '📥'
    };
    return icons[type] || '📊';
  }
}
