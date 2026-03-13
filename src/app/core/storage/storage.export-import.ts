import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { StorageService } from './storage.service';
import { STORAGE_KEYS } from './storage.keys';
import { WorkspaceService, WorkspaceExport } from '../workspace';
import { TelemetryService } from '../telemetry';

export interface ExportedData {
  version: number;
  exportedAt: string;
  data: {
    clients: unknown;
    products: unknown;
    consignations: unknown;
  };
}

/**
 * Serviço para exportar/importar dados por workspace
 * Permite backup completo isolado ou de todos os workspaces
 */
@Injectable({
  providedIn: 'root'
})
export class StorageExportImportService {
  private storage = inject(StorageService);
  private workspaceService = inject(WorkspaceService);
  private telemetryService = inject(TelemetryService);

  /**
   * Exporta dados do workspace atual
   * Retorna Blob pronto para download
   * @param includeTelemetry Se true, inclui eventos de telemetria
   */
  exportWorkspace(includeTelemetry: boolean = true): Blob {
    const workspace = this.workspaceService.requireActive();
    
    const exportData: WorkspaceExport = {
      workspace: workspace,
      clients: this.storage.get(STORAGE_KEYS.clients) || [],
      products: this.storage.get(STORAGE_KEYS.products) || [],
      consignations: this.storage.get(STORAGE_KEYS.consignations) || [],
      exportedAt: new Date().toISOString(),
    };

    // Include telemetry if requested
    if (includeTelemetry) {
      try {
        const telemetryExport = this.telemetryService.exportEvents();
        if (telemetryExport && telemetryExport.events.length > 0) {
          exportData.telemetry = telemetryExport.events;
        }
      } catch (error) {
        console.warn('Failed to export telemetry:', error);
      }
    }

    const json = JSON.stringify(exportData, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Importa dados de workspace
   * Opção 1 (padrão): Cria novo workspace com os dados
   * Opção 2: Sobrescreve workspace atual
   * @param jsonString JSON do backup
   * @param overwriteCurrent Se true, sobrescreve workspace atual. Se false, cria novo.
   * @returns Observable que completa quando a importação termina
   * @throws Error se JSON inválido
   */
  importWorkspace(jsonString: string, overwriteCurrent: boolean = false): Observable<void> {
    let data: WorkspaceExport;

    try {
      data = JSON.parse(jsonString);
    } catch (error) {
      return throwError(() => new Error('JSON inválido. Verifique o arquivo.'));
    }

    // Validar estrutura
    if (!data.workspace || !data.exportedAt) {
      return throwError(() => new Error('Formato de arquivo inválido. Esperado backup de workspace.'));
    }

    if (overwriteCurrent) {
      // Sobrescrever workspace atual
      const current = this.workspaceService.requireActive();
      return this.importDataToWorkspace(current.id, data);
    } else {
      // Criar novo workspace com nome do backup via API
      const importDate = new Date().toLocaleDateString('pt-BR');
      const newName = `${data.workspace.name} (importado ${importDate})`;
      
      return this.workspaceService.create(newName).pipe(
        tap(newWorkspace => {
          console.log('✅ Workspace criado para importação:', newWorkspace);
          // Selecionar o novo workspace
          this.workspaceService.select(newWorkspace);
        }),
        switchMap(newWorkspace => {
          // Importar dados no novo workspace
          return this.importDataToWorkspace(newWorkspace.id, data);
        }),
        catchError(err => {
          console.error('❌ Erro ao criar workspace para importação:', err);
          return throwError(() => new Error('Erro ao criar workspace para importação.'));
        })
      );
    }
  }

  /**
   * Helper privado para importar dados em um workspace específico
   */
  private importDataToWorkspace(workspaceId: string, data: WorkspaceExport): Observable<void> {
    try {
      this.doImportData(workspaceId, data);
      return of(void 0);
    } catch (error) {
      return throwError(() => new Error('Erro ao importar dados. Backup pode estar corrompido.'));
    }
  }

  /**
   * Executa a importação dos dados
   */
  private doImportData(workspaceId: string, data: WorkspaceExport): void {
      if (data.clients) {
        this.storage.set(STORAGE_KEYS.clients, data.clients);
      }
      
      if (data.products) {
        this.storage.set(STORAGE_KEYS.products, data.products);
      }
      
      if (data.consignations) {
        this.storage.set(STORAGE_KEYS.consignations, data.consignations);
      }

      // Import telemetry if present
      if (data.telemetry && Array.isArray(data.telemetry) && data.telemetry.length > 0) {
        try {
          this.telemetryService.importEvents(workspaceId, data.telemetry);
        } catch (error) {
          console.warn('Failed to import telemetry:', error);
        }
      }

      // Log telemetry
      try {
        this.telemetryService.log('import_done', { workspaceId });
      } catch {
        // Silent fail
      }
  }

  /**
   * Gera nome do arquivo de backup
   */
  getBackupFilename(): string {
    const workspace = this.workspaceService.getActive();
    const date = new Date().toISOString().split('T')[0];
    const wsName = workspace ? workspace.name.toLowerCase().replace(/\s+/g, '-') : 'workspace';
    return `vendara-${wsName}-${date}.json`;
  }

  /**
   * Helper para fazer download do backup do workspace atual
   * @param includeTelemetry Se true, inclui eventos de telemetria
   */
  downloadWorkspaceBackup(includeTelemetry: boolean = true): void {
    const blob = this.exportWorkspace(includeTelemetry);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.getBackupFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Log telemetry
    try {
      this.telemetryService.log('export_done', { scope: 'workspace' });
    } catch {
      // Silent fail
    }
  }

  /**
   * LEGACY: Exporta todos os dados (compatibilidade retroativa)
   * @deprecated Use exportWorkspace() para export por workspace
   */
  exportAll(): Blob {
    return this.exportWorkspace(true);
  }

  /**
   * LEGACY: Importa dados antigos (compatibilidade retroativa)
   * @deprecated Use importWorkspace() para import com workspaces
   */
  importAll(jsonString: string): Observable<void> {
    // Tentar importar como workspace primeiro
    return this.importWorkspace(jsonString, false).pipe(
      catchError(err => {
        console.warn('Tentativa de importar como workspace falhou, tentando formato legado:', err);
        return this.importLegacyFormat(jsonString);
      })
    );
  }

  /**
   * Importa formato legado (sem workspace)
   */
  private importLegacyFormat(jsonString: string): Observable<void> {
    // Formato legado (sem workspace)
    let data: ExportedData;
    try {
      data = JSON.parse(jsonString);
    } catch (error) {
      return throwError(() => new Error('JSON inválido. Verifique o arquivo.'));
    }

    if (!data.version || !data.data) {
      return throwError(() => new Error('Formato de arquivo inválido.'));
    }

    if (data.version !== 1) {
      return throwError(() => new Error(`Versão ${data.version} não suportada.`));
    }

    // Importar no workspace atual
    try {
      if (data.data.clients) {
        this.storage.set(STORAGE_KEYS.clients, data.data.clients);
      }
      
      if (data.data.products) {
        this.storage.set(STORAGE_KEYS.products, data.data.products);
      }
      
      if (data.data.consignations) {
        this.storage.set(STORAGE_KEYS.consignations, data.data.consignations);
      }
      
      return of(void 0);
    } catch (error) {
      return throwError(() => new Error('Erro ao importar dados legados.'));
    }
  }

  /**
   * LEGACY: Download backup (compatibilidade retroativa)
   * @deprecated Use downloadWorkspaceBackup()
   */
  downloadBackup(): void {
    this.downloadWorkspaceBackup();
  }
}
