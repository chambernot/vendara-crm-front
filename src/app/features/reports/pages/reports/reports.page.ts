import { Component, OnInit, inject, isDevMode } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { ReportsService, ReportsSummary } from '../../data-access';
import { SectionCardComponent } from '../../../../shared/ui/section-card/section-card.component';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ScoreBadgeComponent } from '../../../../shared/ui/score-badge/score-badge.component';
import { StorageExportImportService, StorageService, STORAGE_KEYS } from '../../../../core/storage';
import { WorkspaceService } from '../../../../core/workspace';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    SectionCardComponent,
    EmptyStateComponent,
    ScoreBadgeComponent
  ],
  templateUrl: './reports.page.html'
})
export class ReportsPage implements OnInit {
  summary$!: Observable<ReportsSummary>;
  includeTelemetry = true; // Default: include telemetry in exports
  
  private exportImportService = inject(StorageExportImportService);
  private storageService = inject(StorageService);
  private workspaceService = inject(WorkspaceService);
  
  // Verifica se está em modo de desenvolvimento
  isProduction = !isDevMode();
  
  constructor(
    private reportsService: ReportsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.summary$ = this.reportsService.getSummary();
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  }

  navigateToProduct(id: string): void {
    this.router.navigate(['/app/catalogo', id]);
  }

  navigateToClient(id: string): void {
    this.router.navigate(['/app/clientes', id]);
  }

  isEmpty(summary: ReportsSummary | null): boolean {
    if (!summary) return true;
    
    return summary.openConsignations === 0 &&
           summary.soldConsignations === 0 &&
           summary.returnedConsignations === 0 &&
           summary.totalCatalogValueAvailable === 0;
  }

  /**
   * Exporta dados do workspace atual em JSON
   */
  exportData(): void {
    try {
      const workspace = this.workspaceService.getActive();
      this.exportImportService.downloadWorkspaceBackup(this.includeTelemetry);
      alert(`✅ Dados do workspace "${workspace?.name}" exportados com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar dados:', error);
      alert('❌ Erro ao exportar dados. Verifique o console.');
    }
  }

  /**
   * Importa dados de arquivo JSON
   * Permite escolher entre criar novo workspace ou sobrescrever atual
   */
  importData(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        
        // Perguntar se deseja sobrescrever workspace atual ou criar novo
        const overwrite = window.confirm(
          '📦 Deseja SOBRESCREVER os dados do workspace atual?\n\n' +
          '✅ SIM = Sobrescrever workspace atual\n' +
          '❌ NÃO = Criar novo workspace com os dados importados'
        );
        
        this.exportImportService.importWorkspace(content, overwrite).subscribe({
          next: () => {
            if (overwrite) {
              alert('✅ Dados importados e workspace atual atualizado! A página será recarregada.');
            } else {
              alert('✅ Novo workspace criado com os dados importados! A página será recarregada.');
            }
            window.location.reload();
          },
          error: (error: any) => {
            console.error('Erro ao importar dados:', error);
            alert(`❌ ${error?.message || 'Erro ao importar dados'}`);
            input.value = '';
          }
        });
      } catch (error: any) {
        console.error('Erro ao importar dados:', error);
        alert(`❌ ${error?.message || 'Erro ao importar dados'}`);
      } finally {
        // Limpar input para permitir novo upload do mesmo arquivo
        input.value = '';
      }
    };

    reader.onerror = () => {
      alert('❌ Erro ao ler arquivo');
      input.value = '';
    };

    reader.readAsText(file);
  }

  /**
   * Reseta todos os dados (DEV only)
   */
  resetData(): void {
    const confirm = window.confirm(
      '⚠️ ATENÇÃO: Isso irá apagar todos os dados e resetar para os dados iniciais. Deseja continuar?'
    );

    if (!confirm) return;

    try {
      this.storageService.clear([
        STORAGE_KEYS.clients,
        STORAGE_KEYS.products,
        STORAGE_KEYS.consignations
      ]);
      alert('✅ Dados resetados! A página será recarregada.');
      window.location.reload();
    } catch (error) {
      console.error('Erro ao resetar dados:', error);
      alert('❌ Erro ao resetar dados. Verifique o console.');
    }
  }
}
