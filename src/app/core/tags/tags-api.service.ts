import { Injectable, inject } from '@angular/core';
import { Observable, map, of } from 'rxjs';
import { ApiClient } from '../api';
import { WorkspaceService } from '../workspace';
import { TagCategory } from './tags.models';

/**
 * Interface para resposta da API
 */
interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string | null;
  errors: any | null;
}

/**
 * Interface para definição de tag
 */
export interface TagDefinition {
  id: string;
  slug: string;
  label: string;
  code: string;
  category: TagCategory;
  scoreImpact: number;
  color: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
}

/**
 * Interface para tag aplicada a cliente
 */
export interface ClientTag {
  clientId: string;
  tagSlug: string;
  appliedAt: string;
}

/**
 * Interface para adicionar tag a cliente
 */
export interface AddTagDto {
  clientId: string;
  tagId: string;  // Backend espera ID, não slug
  tagSlug?: string; // Opcional para fallback
}

/**
 * DTO para criar tag (formato esperado pela API)
 */
export interface CreateTagDto {
  workspaceId?: string;  // WorkspaceId é enviado automaticamente pelo interceptor via header
  name: string;          // API espera "Name" (label da tag)
  slug: string;
  category: string;
  scoreModifier: number; // API espera "scoreModifier" não "scoreImpact"
  color: string;         // API espera HEX color (ex: "#FF5733")
  description?: string;
}

/**
 * Serviço API para gerenciamento de tags
 */
@Injectable({
  providedIn: 'root'
})
export class TagsApiService {
  private apiClient = inject(ApiClient);
  private workspaceService = inject(WorkspaceService);
  private readonly tagsEndpoint = '/tags';
  private readonly clientsEndpoint = '/clients'; // Rota correta para tags de clientes

  /**
   * Lista todas as definições de tags disponíveis
   */
  listTagDefinitions(): Observable<TagDefinition[]> {
    const workspace = this.workspaceService.getActive();
    const workspaceId = workspace?.id;
    let endpoint = this.tagsEndpoint;
    if (workspaceId) {
      endpoint += `?workspaceId=${encodeURIComponent(workspaceId)}`;
    }
    return this.apiClient.get<ApiResponse<any[]>>(endpoint).pipe(
      map(response => {
        const tags = response.data || [];
        // Mapeia campos da API para o formato do frontend
        return tags.map(tag => {
          const label = tag.name || tag.Name || tag.label || tag.Label || '';
          const slug = tag.slug || tag.Slug || this.generateSlug(label);
          return {
            id: tag.id || tag.Id || '',
            slug: slug,
            label: label,
            code: tag.code || tag.Code || slug.toUpperCase(),
            category: (tag.category || tag.Category || 'outros').toLowerCase(),
            scoreImpact: tag.scoreModifier ?? tag.ScoreModifier ?? tag.scoreImpact ?? tag.ScoreImpact ?? 0,
            color: tag.color || tag.Color || '#6B7280',
            description: tag.description || tag.Description || '',
            isSystem: !!(tag.isSystem ?? tag.IsSystem),
            isActive: tag.isActive ?? tag.IsActive ?? true
          };
        });
      })
    );
  }

  /**
   * Gera slug a partir de um texto
   */
  private generateSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9]+/g, '-') // Substitui caracteres especiais por hífen
      .replace(/^-+|-+$/g, ''); // Remove hífens no início/fim
  }

  /**
   * Cria uma nova tag no sistema
   */
  createTag(tag: Omit<TagDefinition, 'id'>): Observable<TagDefinition> {
    const workspaceId = this.workspaceService.getActive()?.id || '';
    
    // Mapeia para o formato esperado pela API
    const dto: CreateTagDto = {
      workspaceId: workspaceId,  // Inclui workspaceId no body
      name: tag.label,  // API espera "name" em vez de "label"
      slug: tag.slug,
      category: tag.category,
      scoreModifier: tag.scoreImpact, // API espera "scoreModifier" não "scoreImpact"
      color: this.tailwindToHex(tag.color), // Converte Tailwind para HEX
      description: tag.description
    };
    
    console.log('🔵 [CREATE TAG] Enviando para API:', dto);
    console.log('🔵 [CREATE TAG] WorkspaceId:', workspaceId);
    console.log('🔵 [CREATE TAG] Score original:', tag.scoreImpact, 'Tipo:', typeof tag.scoreImpact);
    
    return this.apiClient.post<ApiResponse<any>>(this.tagsEndpoint, dto).pipe(
      map(response => {
        const createdTag = response.data;
        // Mapeia resposta da API para formato do frontend
        return {
          id: createdTag.id || createdTag.Id || '',
          slug: createdTag.slug || createdTag.Slug || tag.slug,
          label: createdTag.name || createdTag.Name || tag.label,
          code: createdTag.code || createdTag.Code || (createdTag.slug || createdTag.Slug || tag.slug).toUpperCase(),
          category: (createdTag.category || createdTag.Category || tag.category).toLowerCase(),
          scoreImpact: createdTag.scoreModifier ?? createdTag.ScoreModifier ?? createdTag.scoreImpact ?? createdTag.ScoreImpact ?? tag.scoreImpact,
          color: createdTag.color || createdTag.Color || this.tailwindToHex(tag.color),
          description: createdTag.description || createdTag.Description || tag.description || '',
          isSystem: !!(createdTag.isSystem ?? createdTag.IsSystem),
          isActive: createdTag.isActive ?? createdTag.IsActive ?? true
        };
      })
    );
  }

  /**
   * Converte classe Tailwind para cor HEX
   */
  private tailwindToHex(tailwindClass: string): string {
    // Extrai a cor base da classe (ex: "bg-blue-100" -> "blue")
    const colorMatch = tailwindClass.match(/(?:bg|text)-(\w+)-/);
    
    if (!colorMatch) {
      return '#6B7280'; // gray-500 como fallback
    }
    
    const color = colorMatch[1];
    
    // Mapa de cores Tailwind para HEX
    const colorMap: Record<string, string> = {
      blue: '#3B82F6',
      purple: '#A855F7',
      green: '#10B981',
      yellow: '#F59E0B',
      red: '#EF4444',
      pink: '#EC4899',
      rose: '#F43F5E',
      cyan: '#06B6D4',
      gray: '#6B7280',
      orange: '#F97316',
      lime: '#84CC16',
      emerald: '#10B981',
      teal: '#14B8A6',
      indigo: '#6366F1',
      violet: '#8B5CF6',
      fuchsia: '#D946EF'
    };
    
    return colorMap[color] || '#6B7280';
  }

  /**
   * Atualiza uma tag existente
   * NOTA: Esta rota ainda não está implementada no backend
   */
  updateTag(id: string, tag: Partial<Omit<TagDefinition, 'id'>>): Observable<TagDefinition> {
    console.warn('⚠️ [UPDATE TAG] Rota PUT /tags/{id} ainda não implementada no backend');
    
    const workspaceId = this.workspaceService.getActive()?.id || '';
    
    const dto: Partial<CreateTagDto> = {
      workspaceId: workspaceId,  // Inclui workspaceId no body
      name: tag.label,
      slug: tag.slug,
      category: tag.category,
      scoreModifier: tag.scoreImpact, // API espera "scoreModifier" não "scoreImpact"
      color: tag.color ? this.tailwindToHex(tag.color) : undefined,
      description: tag.description
    };
    
    console.log('🔵 [UPDATE TAG] Dados que seriam enviados:', dto);
    console.log('🔵 [UPDATE TAG] WorkspaceId:', workspaceId);
    
    return this.apiClient.put<ApiResponse<any>>(`${this.tagsEndpoint}/${id}`, dto).pipe(
      map(response => {
        const updatedTag = response.data;
        return {
          id: updatedTag.id || updatedTag.Id || id,
          slug: updatedTag.slug || updatedTag.Slug || tag.slug || '',
          label: updatedTag.name || updatedTag.Name || tag.label || '',
          code: updatedTag.code || updatedTag.Code || (updatedTag.slug || updatedTag.Slug || tag.slug || '').toUpperCase(),
          category: (updatedTag.category || updatedTag.Category || tag.category || 'outros').toLowerCase(),
          scoreImpact: updatedTag.scoreModifier ?? updatedTag.ScoreModifier ?? updatedTag.scoreImpact ?? updatedTag.ScoreImpact ?? tag.scoreImpact ?? 0,
          color: updatedTag.color || updatedTag.Color || tag.color || '#6B7280',
          description: updatedTag.description || updatedTag.Description || tag.description || '',
          isSystem: !!(updatedTag.isSystem ?? updatedTag.IsSystem),
          isActive: updatedTag.isActive ?? updatedTag.IsActive ?? true
        };
      })
    );
  }

  /**
   * Deleta uma tag do sistema
   */
  deleteTag(id: string): Observable<void> {
    return this.apiClient.delete<ApiResponse<void>>(`${this.tagsEndpoint}/${id}`).pipe(
      map(response => response.data)
    );
  }

  /**
   * Busca tags de um cliente
   */
  getClientTags(clientId: string): Observable<ClientTag[]> {
    return this.apiClient.get<ApiResponse<ClientTag[]>>(`${this.clientsEndpoint}/${clientId}/tags`).pipe(
      map(response => response.data || [])
    );
  }

  /**
   * Adiciona tag a um cliente
   */
  addTagToClient(dto: AddTagDto): Observable<ClientTag> {
    console.log('🔵 [ADD TAG] Aplicando tag ao cliente:', dto);
    
    // O backend espera: { action: "add", tagIds: [id] }
    const payload = {
      action: "add",
      tagIds: [dto.tagId] // Envia o ID da tag
    };
    
    console.log('🔵 [ADD TAG] Payload enviado:', payload);
    
    return this.apiClient.post<ApiResponse<any>>(`${this.clientsEndpoint}/${dto.clientId}/tags`, payload).pipe(
      map(response => {
        console.log('🔵 [ADD TAG] Resposta da API:', response);
        console.log('🔵 [ADD TAG] Cliente retornado:', response.data);
        console.log('🔵 [ADD TAG] Tags do cliente:', response.data?.tags);
        return response.data;
      })
    );
  }

  /**
   * Adiciona múltiplas tags (por IDs) a um cliente.
   * Útil no cadastro do cliente para garantir persistência no Mongo via API.
   */
  addTagsToClient(clientId: string, tagIds: string[]): Observable<any> {
    const cleanIds = (tagIds || []).filter(Boolean);
    if (cleanIds.length === 0) {
      return of(null);
    }

    const payload = {
      action: 'add',
      tagIds: cleanIds,
    };

    console.log('🔵 [ADD TAGS] Aplicando tags ao cliente:', { clientId, tagIds: cleanIds });
    console.log('🔵 [ADD TAGS] Payload enviado:', payload);

    return this.apiClient.post<ApiResponse<any>>(`${this.clientsEndpoint}/${clientId}/tags`, payload).pipe(
      map(response => response.data)
    );
  }

  /**
   * Remove tag de um cliente
   */
  removeTagFromClient(clientId: string, tagId: string): Observable<void> {
    // O backend espera: { action: "remove", tagIds: [id] }
    const payload = {
      action: "remove",
      tagIds: [tagId]
    };
    
    console.log('🔵 [REMOVE TAG] Removendo tag:', payload);
    
    return this.apiClient.post<ApiResponse<void>>(`${this.clientsEndpoint}/${clientId}/tags`, payload).pipe(
      map(response => response.data)
    );
  }

  /**
   * Atualiza múltiplas tags de um cliente de uma vez
   */
  updateClientTags(clientId: string, tagSlugs: string[]): Observable<ClientTag[]> {
    return this.apiClient.put<ApiResponse<ClientTag[]>>(`${this.clientsEndpoint}/${clientId}/tags`, { tags: tagSlugs }).pipe(
      map(response => response.data || [])
    );
  }
}
