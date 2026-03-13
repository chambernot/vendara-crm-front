import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

/**
 * Configuração de retry para requisições HTTP
 */
const RETRY_CONFIG = {
  count: 2,
  delay: 1000,
  excludedStatusCodes: [400, 401, 403, 404, 422]
};

/**
 * Cliente HTTP centralizado para comunicação com a API
 * Gerencia baseUrl, headers e tratamento de erros
 */
@Injectable({
  providedIn: 'root'
})
export class ApiClient {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  /**
   * Realiza requisição GET
   */
  get<T>(endpoint: string, options?: { headers?: HttpHeaders }): Observable<T> {
    const url = this.buildUrl(endpoint);
    console.log('📥 [ApiClient] GET request:', { url, endpoint, baseUrl: this.baseUrl, options });
    console.log('📥 [ApiClient] URL includes /api?', url.includes('/api'));
    return this.http.get<T>(url, options).pipe(
      retry({
        count: RETRY_CONFIG.count,
        delay: RETRY_CONFIG.delay,
        resetOnSuccess: true
      }),
      catchError(this.handleError)
    );
  }

  /**
   * Realiza requisição POST
   */
  post<T>(endpoint: string, body: any, options?: { headers?: HttpHeaders }): Observable<T> {
    const url = this.buildUrl(endpoint);
    console.log('📤 [ApiClient] POST request:', { url, endpoint, baseUrl: this.baseUrl, body, options });
    console.log('📤 [ApiClient] URL includes /api?', url.includes('/api'));
 return this.http.post<T>(url, body, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Realiza requisição PUT
   */
  put<T>(endpoint: string, body: any, options?: { headers?: HttpHeaders }): Observable<T> {
    const url = this.buildUrl(endpoint);
    console.log('📤 [ApiClient] PUT request:', { url, body });
    return this.http.put<T>(url, body, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Realiza requisição PATCH
   */
  patch<T>(endpoint: string, body: any, options?: { headers?: HttpHeaders }): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.patch<T>(url, body, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Realiza requisição DELETE
   */
  delete<T>(endpoint: string, options?: { headers?: HttpHeaders }): Observable<T> {
    const url = this.buildUrl(endpoint);
    return this.http.delete<T>(url, options).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Constrói URL completa com baseUrl
   */
  private buildUrl(endpoint: string): string {
    // Se endpoint já começa com baseUrl, retorna direto
    if (endpoint.startsWith(this.baseUrl)) {
      return endpoint;
    }
    
    // Se baseUrl está vazio, retorna endpoint direto
    if (!this.baseUrl) {
      return endpoint;
    }
    
    // Remove barra inicial do endpoint se existir
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    // Remove barra final do baseUrl se existir
    const cleanBaseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
    return `${cleanBaseUrl}/${cleanEndpoint}`;
  }

  /**
   * Trata erros HTTP de forma centralizada
   * Mostra mensagens específicas para workspace não selecionado e endpoints inexistentes
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Erro ao comunicar com o servidor';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      // Detectar erro relacionado a workspace
      const errorBody = error.error?.message || error.error?.error || '';
      const isWorkspaceError = typeof errorBody === 'string' && (
        errorBody.toLowerCase().includes('workspace') ||
        errorBody.toLowerCase().includes('ambiente')
      );

      switch (error.status) {
        case 0:
          errorMessage = 'Não foi possível conectar ao servidor. Verifique sua conexão.';
          break;
        case 400:
          if (isWorkspaceError) {
            errorMessage = 'Workspace não selecionado. Selecione um ambiente para continuar.';
          } else {
            errorMessage = error.error?.message || 'Requisição inválida';
          }
          console.error('[ApiClient] 400 Bad Request details:', {
            url: error.url,
            message: error.error?.message,
            errors: error.error?.errors,
            isWorkspaceError,
          });
          break;
        case 401:
          errorMessage = 'Não autorizado. Faça login novamente.';
          break;
        case 403:
          errorMessage = 'Acesso negado';
          break;
        case 404:
          if (error.url) {
            const path = error.url.replace(/.*\/api/, '/api').split('?')[0];
            errorMessage = `Endpoint não encontrado: ${path}`;
          } else {
            errorMessage = 'Recurso não encontrado';
          }
          break;
        case 422:
          errorMessage = error.error?.message || 'Dados inválidos';
          break;
        case 500:
          errorMessage = 'Erro interno do servidor';
          break;
        case 503:
          errorMessage = 'Serviço temporariamente indisponível';
          break;
        default:
          errorMessage = error.error?.message || `Erro ${error.status}: ${error.statusText}`;
      }
    }

    console.error('[ApiClient]', errorMessage, error);
    
    return throwError(() => ({
      message: errorMessage,
      status: error.status,
      error: error.error
    }));
  }
}
