import { Injectable, inject } from '@angular/core';
import { Observable, tap, map, catchError, throwError } from 'rxjs';
import { 
  Workspace, 
  CreateWorkspaceDto, 
  WorkspaceListResponse, 
  WorkspaceResponse 
} from './workspace.models';
import { WORKSPACE_STORAGE_KEYS, LEGACY_KEYS, keyFor } from './workspace.storage';
import { TelemetryService } from '../telemetry';
import { ApiClient } from '../api';
import { EventBusService } from '../../shared/services/event-bus.service';

@Injectable({
  providedIn: 'root',
})
export class WorkspaceService {
  private apiClient = inject(ApiClient);
  private telemetryService = inject(TelemetryService);
  private eventBus = inject(EventBusService);
  
  // ⚠️ IMPORTANTE: Workspace é persistido no MongoDB via API
  // SessionStorage é usado APENAS para manter o ID do workspace ativo na sessão atual
  // Não usar localStorage - tudo deve vir da API
  private currentWorkspaceId: string | null = null;
  private currentWorkspace: Workspace | null = null;

  /**
   * Verifica se uma string é um MongoDB ObjectId válido (24 caracteres hexadecimais)
   */
  private isMongoObjectId(value: string): boolean {
    return /^[a-f0-9]{24}$/i.test(value);
  }

  /**
   * Detecta se o valor é um formato composto inválido (UUID_slug)
   * Ex: "62fd3464-5d57-4367-8170-a3c87686b129_testemvp" → true
   */
  private isCompositeId(value: string): boolean {
    // Padrão: UUID (com hifens) seguido de underscore e texto
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}_.+$/i.test(value);
  }

  /**
   * Normaliza workspace vindo do backend (mapeia _id para id)
   * ✅ CORREÇÃO: Prioriza _id (MongoDB ObjectId) sobre id
   * ✅ CORREÇÃO: Detecta e rejeita formato composto UUID_slug
   */
  private normalizeWorkspace(data: any): Workspace {
    console.log('🔄 [WORKSPACE] Normalizando workspace - dados RAW do backend:', JSON.stringify(data));
    console.log('🔄 [WORKSPACE] Campos disponíveis:', Object.keys(data));
    console.log('🔄 [WORKSPACE] data.id:', data.id);
    console.log('🔄 [WORKSPACE] data._id:', data._id);
    console.log('🔄 [WORKSPACE] data.workspaceId:', data.workspaceId);
    
    // Coletar todos os candidatos a ID
    const candidates = [
      { source: '_id', value: data._id },
      { source: 'id', value: data.id },
      { source: 'workspaceId', value: data.workspaceId },
      { source: 'objectId', value: data.objectId },
    ].filter(c => c.value && typeof c.value === 'string');
    
    console.log('🔄 [WORKSPACE] Candidatos a ID:', candidates);
    
    let id: string | undefined;
    
    // 1. Prioridade: Qualquer candidato que seja um MongoDB ObjectId válido
    for (const candidate of candidates) {
      if (this.isMongoObjectId(candidate.value)) {
        id = candidate.value;
        console.log(`✅ [WORKSPACE] Usando ${candidate.source} (MongoDB ObjectId):`, id);
        break;
      }
    }
    
    // 2. Se nenhum é ObjectId, usar o primeiro que NÃO é composite (UUID_slug)
    if (!id) {
      for (const candidate of candidates) {
        if (!this.isCompositeId(candidate.value)) {
          id = candidate.value;
          console.warn(`⚠️ [WORKSPACE] Usando ${candidate.source} (não é ObjectId, mas não é composto):`, id);
          break;
        } else {
          console.warn(`⚠️ [WORKSPACE] Rejeitando ${candidate.source} (formato composto UUID_slug detectado):`, candidate.value);
        }
      }
    }
    
    // 3. Último recurso: usar qualquer candidato, mesmo composto
    if (!id && candidates.length > 0) {
      id = candidates[0].value;
      console.error(`❌ [WORKSPACE] ATENÇÃO: Usando ${candidates[0].source} como último recurso (pode ser composto!):`, id);
      console.error('❌ [WORKSPACE] O backend precisa retornar _id como MongoDB ObjectId!');
    }
    
    if (!id) {
      console.error('❌ [WORKSPACE] Workspace sem ID:', data);
      throw new Error('Workspace sem identificador válido');
    }
    
    const normalized: Workspace = {
      id: id,
      name: data.name || 'Workspace',
      slug: data.slug,
      createdAt: data.createdAt || new Date().toISOString(),
      ownerId: data.ownerId || data.ownerUserId
    };
    
    console.log('✅ [WORKSPACE] Workspace normalizado FINAL:', normalized);
    
    return normalized;
  }

  /**
   * Lista todos os workspaces do usuário via novo endpoint /api/workspaces/my
   * Retorna workspaces com role do usuário em cada workspace
   * 
   * ⚠️ FALLBACK: Se o endpoint /my não estiver disponível (403/404), usa /workspaces
   */
  getMyWorkspaces(): Observable<Workspace[]> {
    console.log('📋 [WORKSPACE] Buscando workspaces do usuário via /api/workspaces/my');
    return this.apiClient.get<any>('/workspaces/my').pipe(
      catchError(err => {
        // Se o endpoint /my não existe ou retorna 403/404, usar endpoint antigo
        if (err.status === 403 || err.status === 404) {
          console.warn('⚠️ [WORKSPACE] Endpoint /my não disponível, usando fallback /workspaces');
          console.warn('⚠️ [WORKSPACE] Status:', err.status, '- Backend ainda não implementou /api/workspaces/my');
          return this.apiClient.get<any>('/workspaces');
        }
        // Outros erros, propagar
        return throwError(() => err);
      }),
      map(response => {
        console.log('✅ [WORKSPACE] Resposta completa da API:', response);
        console.log('✅ [WORKSPACE] response.data:', response.data);
        console.log('✅ [WORKSPACE] Array.isArray(response.data):', Array.isArray(response.data));
        
        // Backend retorna: { success: true, data: [...], message: '...' }
        let workspaces: any[] = [];
        
        if (response.data && Array.isArray(response.data)) {
          workspaces = response.data;
        } else if (response.workspaces && Array.isArray(response.workspaces)) {
          workspaces = response.workspaces;
        } else if (Array.isArray(response)) {
          workspaces = response;
        }
        
        console.log('✅ [WORKSPACE] Lista processada:', workspaces);
        console.log('✅ [WORKSPACE] Total de workspaces:', workspaces.length);
        
        // Normalizar todos os workspaces (mapear _id para id) + preservar role
        return workspaces.map(ws => {
          const normalized = this.normalizeWorkspace(ws);
          // Preservar role retornado pela API (se disponível)
          if (ws.role) {
            normalized.role = ws.role;
            console.log(`✅ [WORKSPACE] Workspace ${normalized.name} - role: ${ws.role}`);
          }
          return normalized;
        });
      })
    );
  }

  /**
   * Lista todos os workspaces via API (Alias para getMyWorkspaces)
   * ⚠️ ATUALIZADO: Agora usa o novo endpoint /api/workspaces/my
   */
  list(): Observable<Workspace[]> {
    return this.getMyWorkspaces();
  }

  /**
   * Lista todos os workspaces via API
   * ⚠️ ATUALIZADO: Agora usa o novo endpoint /api/workspaces/my  
   */
  getWorkspaces(): Observable<Workspace[]> {
    return this.getMyWorkspaces();
  }

  /**
   * Cria um novo workspace via API
   */
  create(name: string): Observable<Workspace> {
    return this.createWorkspace(name);
  }

  /**
   * Cria um novo workspace via API
   */
  createWorkspace(name: string): Observable<Workspace> {
    const trimmedName = name.trim();
    const slug = this.generateSlug(trimmedName);
    
    const dto: CreateWorkspaceDto = { 
      name: trimmedName,
      slug: slug
    };
    
    console.log('🏗️ [WORKSPACE] Criando workspace via API:', dto);
    
    return this.apiClient.post<any>('/workspaces', dto).pipe(
      map(response => {
        console.log('✅ [WORKSPACE] Resposta da API:', response);
        
        // Backend pode retornar diferentes formatos:
        // 1. { workspace: {...} }
        // 2. Diretamente o workspace {...}
        // 3. { success: true, data: {...}, message: '...' }
        let workspaceData = response.workspace || response.data || response;
        
        // Se data está vazio mas temos message de sucesso, tentar recarregar lista
        if ((!workspaceData || (!workspaceData.id && !workspaceData._id)) && response.success && response.message) {
          console.warn('⚠️ [WORKSPACE] Backend retornou sucesso mas sem dados do workspace');
          throw new Error('Workspace criado mas dados não retornados. Recarregue a página.');
        }
        
        if (!workspaceData || (!workspaceData.id && !workspaceData._id)) {
          console.error('❌ [WORKSPACE] Resposta inválida da API:', response);
          throw new Error('Resposta inválida da API ao criar workspace');
        }
        
        // Normalizar workspace (mapear _id para id)
        return this.normalizeWorkspace(workspaceData);
      }),
      tap(workspace => {
        console.log('✅ [WORKSPACE] Workspace criado com sucesso:', workspace);
      })
    );
  }

  /**
   * Seleciona um workspace (salva no storage e notifica o backend)
   */
  selectWorkspace(id: string): Observable<void> {
    console.log('🔄 [WORKSPACE] ========== SELECT WORKSPACE (API) ==========');
    console.log('🔄 [WORKSPACE] Notificando backend sobre seleção:', id);
    console.log('🔄 [WORKSPACE] URL:', `/workspaces/${id}/select`);
    
    return this.apiClient.post<any>(`/workspaces/${id}/select`, {}).pipe(
      tap((response) => {
        console.log('✅ [WORKSPACE] Backend confirmou seleção de workspace');

        // Alguns backends retornam token/usuário atualizado (com workspace no contexto/claims).
        // Aceitamos ambos formatos: { token, user } ou { data: { token, user } }.
        const data = response?.data ?? response;
        const token = data?.token;
        const user = data?.user;

        if (token && typeof token === 'string') {
          console.log('🔐 [WORKSPACE] Token atualizado recebido no selectWorkspace()');
          localStorage.setItem('vendara_token', token);
        }

        if (user) {
          try {
            localStorage.setItem('vendara_user', JSON.stringify(user));
          } catch {
            // ignore
          }
        }

        this.setCurrentWorkspace(id);
      }),
      map(() => void 0),
      catchError(err => {
        console.error('❌ [WORKSPACE] Erro ao notificar backend:', err);
        console.error('❌ [WORKSPACE] Status:', err.status);
        console.error('❌ [WORKSPACE] Mensagem:', err.error?.message || err.message);
        throw err;
      })
    );
  }

  /**
   * Seleciona um workspace (mantém em memória + sessionStorage para a sessão)
   * ⚠️ Workspace é persistido no MongoDB via API, não em localStorage
   */
  select(workspace: Workspace): void {
    console.log('💾 [WORKSPACE] ========== SELECT WORKSPACE INICIADO ==========');
    console.log('💾 [WORKSPACE] Workspace recebido:', workspace);
    console.log('💾 [WORKSPACE] Workspace ID:', workspace.id);
    console.log('💾 [WORKSPACE] Workspace Name:', workspace.name);
    
    if (!workspace.id) {
      console.error('❌ [WORKSPACE] Tentativa de salvar workspace sem ID!', workspace);
      throw new Error('Workspace inválido: sem ID');
    }
    
    // ✅ CORREÇÃO: Validar que o ID não é formato composto UUID_slug
    if (this.isCompositeId(workspace.id)) {
      console.error('❌ [WORKSPACE] BLOQUEANDO salvamento de ID composto (UUID_slug):', workspace.id);
      console.error('❌ [WORKSPACE] O backend retornou um ID inválido. Esperado: MongoDB ObjectId (24 hex chars)');
      console.error('❌ [WORKSPACE] Dados completos do workspace:', JSON.stringify(workspace));
      throw new Error(`Workspace com ID inválido (formato composto): ${workspace.id}`);
    }
    
    // Salvar em memória (prioridade)
    this.currentWorkspace = workspace;
    this.currentWorkspaceId = workspace.id;
    
    // Persistência: sessionStorage (sessão) + localStorage (persistente) para evitar perda
    // de contexto ao recarregar páginas/abrir novas abas.
    try {
      console.log('💾 [WORKSPACE] Tentando salvar em sessionStorage...');
      console.log('💾 [WORKSPACE] workspace.id:', workspace.id);
      console.log('💾 [WORKSPACE] typeof workspace.id:', typeof workspace.id);
      
      sessionStorage.setItem('currentWorkspaceId', workspace.id);
      sessionStorage.setItem('currentWorkspace', JSON.stringify(workspace));

      // ✅ CORREÇÃO: Salvar TAMBÉM com chave 'workspaceId' (sem 'current') para compatibilidade com backend
      localStorage.setItem('workspaceId', workspace.id);  // Backend espera essa chave
      localStorage.setItem('currentWorkspaceId', workspace.id);
      localStorage.setItem('currentWorkspace', JSON.stringify(workspace));
      
      // VERIFICAÇÃO IMEDIATA
      const check1 = sessionStorage.getItem('currentWorkspaceId');
      const check2 = sessionStorage.getItem('currentWorkspace');
      const check3 = localStorage.getItem('workspaceId');
      console.log('🔍 [WORKSPACE] Verificação imediata storage:');
      console.log('  - sessionStorage.currentWorkspaceId:', check1);
      console.log('  - sessionStorage.currentWorkspace:', check2);
      console.log('  - localStorage.workspaceId:', check3);
      console.log('  - Match?', check1 === workspace.id && check3 === workspace.id);
      
      if (check1 !== workspace.id) {
        console.error('❌ [WORKSPACE] FALHA CRÍTICA: Storage não salvou corretamente!');
        console.error('  Esperado:', workspace.id);
        console.error('  sessionStorage:', check1);
        console.error('  localStorage:', check3);
      } else {
        console.log('✅ [WORKSPACE] Workspace salvo em memória + storage com sucesso');
        console.log('✅ [WORKSPACE] localStorage.workspaceId (para backend):', check3);
      }
    } catch (e) {
      console.error('❌ [WORKSPACE] ERRO ao salvar em sessionStorage:', e);
      console.error('❌ [WORKSPACE] Tipo do erro:', typeof e);
      console.error('❌ [WORKSPACE] Mensagem:', e);
    }
    
    console.log('✅ [WORKSPACE] Workspace configurado:', {
      id: workspace.id,
      name: workspace.name,
      inMemory: true,
      currentWorkspaceId: this.getCurrentWorkspaceId()
    });
    
    console.log('💾 [WORKSPACE] ========== SELECT WORKSPACE FINALIZADO ==========');

    // Log telemetry
    this.telemetryService.log('workspace_selected', { 
      workspaceId: workspace.id,
      workspaceName: workspace.name 
    });

    // Notify services that workspace changed (TemplateStore, etc.)
    this.eventBus.emit('workspaceChanged', { workspaceId: workspace.id });
  }

  /**
   * Define o workspace ativo (retrocompatibilidade - usar select() preferenciamente)
   */
  setActive(id: string): void {
    console.warn('⚠️ setActive() está deprecado, use select() com objeto Workspace completo');
    const workspace: Workspace = {
      id,
      name: 'Workspace',
      createdAt: new Date().toISOString()
    };
    this.select(workspace);
  }

  /**
   * Define o workspace atual (apenas ID)
   * ⚠️ Usa memória + sessionStorage, não localStorage
   */
  setCurrentWorkspace(id: string): void {
    console.log('📝 [WORKSPACE] Configurando workspace ID:', id);
    
    // Salvar em memória (prioridade)
    this.currentWorkspaceId = id;
    
    // Backup em sessionStorage (limpo ao fechar aba)
    try {
      sessionStorage.setItem('currentWorkspaceId', id);
      console.log('✅ [WORKSPACE] Workspace ID configurado em memória + sessionStorage');
    } catch (e) {
      console.warn('⚠️ [WORKSPACE] Não foi possível salvar em sessionStorage:', e);
    }

    // Persistir também em localStorage para sobreviver a reload/nova aba
    try {
      localStorage.setItem('currentWorkspaceId', id);
    } catch {
      // ignore
    }
  }

  /**
   * Retorna o ID do workspace atual
   * Prioriza memória, fallback para sessionStorage
   */
  getCurrentWorkspaceId(): string | null {
    console.log('🔍 [WORKSPACE] getCurrentWorkspaceId() chamado');
    console.log('🔍 [WORKSPACE] this.currentWorkspaceId (memória):', this.currentWorkspaceId);
    
    // Priorizar memória
    if (this.currentWorkspaceId) {
      console.log('✅ [WORKSPACE] Retornando ID da memória:', this.currentWorkspaceId);
      return this.currentWorkspaceId;
    }
    
    // Fallback: tentar recuperar do sessionStorage
    console.log('🔄 [WORKSPACE] Memória vazia, tentando sessionStorage...');
    try {
      const id = sessionStorage.getItem('currentWorkspaceId');
      console.log('🔍 [WORKSPACE] sessionStorage.getItem result:', id);
      
      if (id) {
        console.log('🔄 [WORKSPACE] Workspace ID recuperado do sessionStorage:', id);
        this.currentWorkspaceId = id; // Restaurar para memória
        return id;
      }
    } catch (e) {
      console.error('❌ [WORKSPACE] ERRO ao ler sessionStorage:', e);
    }

    // Último fallback: localStorage (persistente)
    console.log('🔄 [WORKSPACE] sessionStorage vazio, tentando localStorage...');
    try {
      const id = localStorage.getItem('currentWorkspaceId');
      console.log('🔍 [WORKSPACE] localStorage.getItem result:', id);
      if (id) {
        this.currentWorkspaceId = id;
        try {
          sessionStorage.setItem('currentWorkspaceId', id);
        } catch {
          // ignore
        }
        return id;
      }
    } catch (e) {
      console.error('❌ [WORKSPACE] ERRO ao ler localStorage:', e);
    }
    
    console.error('❌ [WORKSPACE] getCurrentWorkspaceId: NENHUM ID ENCONTRADO');
    console.error('❌ [WORKSPACE] Memória:', this.currentWorkspaceId);
    console.error('❌ [WORKSPACE] SessionStorage:', (() => { try { return sessionStorage.getItem('currentWorkspaceId'); } catch { return 'ERRO'; } })());
    return null;
  }

  /**
   * Retorna o workspace ativo
   * Prioriza memória, fallback para sessionStorage
   * ⚠️ Workspace completo vem da API, não de storage local
   */
  getActive(): Workspace | null {
    console.log('🔍 [WORKSPACE] getActive() chamado');
    
    // Priorizar memória
    if (this.currentWorkspace) {
      console.log('✅ [WORKSPACE] Workspace em memória:', this.currentWorkspace);
      return this.currentWorkspace;
    }
    
    // Fallback: tentar recuperar do sessionStorage
    try {
      const stored = sessionStorage.getItem('currentWorkspace');
      if (stored) {
        const workspace = JSON.parse(stored) as Workspace;
        console.log('🔄 [WORKSPACE] Workspace recuperado do sessionStorage:', workspace);
        this.currentWorkspace = workspace; // Restaurar para memória
        return workspace;
      }
    } catch (e) {
      console.warn('⚠️ [WORKSPACE] Erro ao ler workspace do sessionStorage:', e);
    }

    // Último fallback: localStorage
    try {
      const stored = localStorage.getItem('currentWorkspace');
      if (stored) {
        const workspace = JSON.parse(stored) as Workspace;
        console.log('🔄 [WORKSPACE] Workspace recuperado do localStorage:', workspace);
        this.currentWorkspace = workspace;
        try {
          sessionStorage.setItem('currentWorkspace', JSON.stringify(workspace));
        } catch {
          // ignore
        }
        return workspace;
      }
    } catch (e) {
      console.warn('⚠️ [WORKSPACE] Erro ao ler workspace do localStorage:', e);
    }
    
    // Se tem ID mas não tem workspace completo, retornar objeto mínimo
    const id = this.getCurrentWorkspaceId();
    if (id) {
      console.warn('⚠️ [WORKSPACE] Apenas ID disponível, criando objeto mínimo');
      return {
        id,
        name: 'Workspace',
        createdAt: new Date().toISOString()
      };
    }
    
    console.warn('⚠️ [WORKSPACE] Nenhum workspace ativo encontrado');
    return null;
  }

  /**
   * Limpa o workspace ativo (memória + sessionStorage)
   */
  clearActive(): void {
    console.log('🗑️ [WORKSPACE] Limpando workspace ativo');
    this.currentWorkspace = null;
    this.currentWorkspaceId = null;
    
    try {
      sessionStorage.removeItem('currentWorkspaceId');
      sessionStorage.removeItem('currentWorkspace');
    } catch (e) {
      console.warn('⚠️ [WORKSPACE] Erro ao limpar sessionStorage:', e);
    }

    try {
      localStorage.removeItem('currentWorkspaceId');
      localStorage.removeItem('currentWorkspace');
    } catch {
      // ignore
    }
  }

  /**
   * Retorna o workspace ativo ou lança erro
   */
  requireActive(): Workspace {
    const workspace = this.getActive();
    if (!workspace) {
      throw new Error('Nenhum workspace ativo');
    }
    return workspace;
  }

  /**
   * Verifica se existe workspace ativo
   */
  hasActive(): boolean {
    return this.getActive() !== null;
  }

  /**
   * Migra dados antigos (sem workspace) para um workspace "Padrão"
   * NOTA: Método mantido para retrocompatibilidade, mas workspaces devem vir da API
   */
  migrateOldData(): void {
    console.log('🔄 migrateOldData() chamado - workspaces agora vêm da API');
    
    // Limpar dados antigos do localStorage se existirem
    const oldWorkspacesList = localStorage.getItem('vendara_workspaces_v1');
    if (oldWorkspacesList) {
      console.log('🗑️ Removendo lista antiga de workspaces do localStorage');
      localStorage.removeItem('vendara_workspaces_v1');
    }

    // Verificar se existem dados antigos de clientes/produtos/consignações
    const hasOldClients = localStorage.getItem(LEGACY_KEYS.CLIENTS);
    const hasOldProducts = localStorage.getItem(LEGACY_KEYS.PRODUCTS);
    const hasOldConsignations = localStorage.getItem(LEGACY_KEYS.CONSIGNATIONS);

    if (hasOldClients || hasOldProducts || hasOldConsignations) {
      console.warn('⚠️ Dados antigos detectados no localStorage - migração automática desabilitada');
      console.warn('⚠️ Use a funcionalidade de importação para mover dados para um workspace');
    }
  }

  /**
   * Gera ID único para workspace (retrocompatibilidade)
   */
  private generateId(): string {
    return `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Gera slug a partir do nome do workspace
   * Remove acentos, converte para minúsculas e substitui espaços por hífens
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
      .trim()
      .replace(/\s+/g, '-') // Substitui espaços por hífens
      .replace(/-+/g, '-') // Remove hífens duplicados
      .substring(0, 100); // Limita a 100 caracteres
  }
}
