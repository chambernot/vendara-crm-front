import { Injectable, inject, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { ClientsApiService, CreateClientDto, UpdateClientDto, ScoreResult } from './clients-api.service';
import { Client } from './clients.models';
import { SalesApiService, Sale, CreateSaleDto, ClientActivity, CreateActivityDto } from './sales-api.service';
import { WorkspaceService } from '../../../core/workspace';

/**
 * Facade que gerencia acesso a dados de clientes via API
 * SEMPRE usa a API - sem fallback para LocalStorage
 */
@Injectable({
  providedIn: 'root'
})
export class ClientsDataService {
  private clientsApi = inject(ClientsApiService);
  private salesApi = inject(SalesApiService);
  private workspaceService = inject(WorkspaceService);

  // Estado de loading
  private loadingSignal = signal<boolean>(false);
  loading = this.loadingSignal.asReadonly();

  // Estado de erro
  private errorSignal = signal<string | null>(null);
  error = this.errorSignal.asReadonly();

  /**
   * Lista todos os clientes
   * workspaceId é enviado automaticamente via header pelo interceptor
   */
  listClients(): Observable<Client[]> {
    return this.withLoadingAndError(() => this.clientsApi.list());
  }

  /**
   * Busca cliente por ID
   */
  getClientById(id: string): Observable<Client | null> {
    return this.withLoadingAndError(() => this.clientsApi.getById(id));
  }

  /**
   * Cria novo cliente
   */
  createClient(dto: CreateClientDto): Observable<Client> {
    const ws = this.workspaceService.getActive();
    const payload: CreateClientDto = ws ? { ...dto, workspaceId: dto.workspaceId ?? ws.id } : dto;
    console.log('🔵 [ClientsDataService] Creating client - payload:', payload);
    console.log('🔵 [ClientsDataService] Active workspace:', ws);
    return this.withLoadingAndError(() => this.clientsApi.create(payload));
  }

  /**
   * Atualiza cliente
   */
  updateClient(id: string, dto: UpdateClientDto): Observable<Client> {
    return this.withLoadingAndError(() => this.clientsApi.update(id, dto));
  }

  /**
   * Remove cliente
   */
  deleteClient(id: string): Observable<void> {
    return this.withLoadingAndError(() => this.clientsApi.delete(id));
  }

  /**
   * Registra venda
   */
  createSale(dto: CreateSaleDto): Observable<Sale> {
    return this.withLoadingAndError(() => this.salesApi.createSale(dto));
  }

  /**
   * Busca vendas de um cliente
   */
  getSalesByClient(clientId: string): Observable<Sale[]> {
    return this.withLoadingAndError(() => this.salesApi.getSalesByClient(clientId));
  }

  /**
   * Cria atividade
   */
  createActivity(dto: CreateActivityDto): Observable<ClientActivity> {
    return this.withLoadingAndError(() => this.salesApi.createActivity(dto));
  }

  /**
   * Busca atividades de um cliente
   */
  getActivitiesByClient(clientId: string): Observable<ClientActivity[]> {
    return this.withLoadingAndError(() => this.salesApi.getActivitiesByClient(clientId));
  }

  /**
   * Busca score com breakdown detalhado do cliente
   * GET /api/Clients/{id}/score
   */
  getClientScore(clientId: string): Observable<ScoreResult> {
    return this.clientsApi.getClientScore(clientId);
  }

  /**
   * Wrapper para gerenciar loading e erros
   */
  private withLoadingAndError<T>(fn: () => Observable<T>): Observable<T> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return fn().pipe(
      catchError(err => {
        const errorMsg = err.message || 'Erro desconhecido';
        this.errorSignal.set(errorMsg);
        console.error('❌ ClientsDataService error:', err);
        console.error('❌ ClientsDataService error.error:', err.error);
        console.error('❌ ClientsDataService error.error.errors:', err.error?.errors);
        
        // Tentar mostrar o JSON completo do erro
        try {
          console.error('❌ Full error JSON:', JSON.stringify(err, null, 2));
        } catch (e) {
          console.error('❌ Could not stringify error');
        }
        
        return throwError(() => err);
      }),
      finalize(() => {
        this.loadingSignal.set(false);
      })
    );
  }

  /**
   * Limpa erro
   */
  clearError(): void {
    this.errorSignal.set(null);
  }
}
