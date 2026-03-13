export interface Workspace {
  id: string;
  name: string;
  slug?: string; // Slug único para uso em URLs/headers
  createdAt: string; // ISO 8601
  ownerId?: string; // ID do proprietário
  role?: string; // Role do usuário no workspace (owner, admin, user, etc.)
}

export interface WorkspaceExport {
  workspace: Workspace;
  clients: any[];
  products: any[];
  consignations: any[];
  telemetry?: any[]; // Optional telemetry events
  exportedAt: string;
}

/**
 * DTO para criação de workspace via API
 */
export interface CreateWorkspaceDto {
  name: string;
  slug: string; // Slug único (gerado a partir do nome)
}

/**
 * Resposta da API para lista de workspaces
 */
export interface WorkspaceListResponse {
  workspaces: Workspace[];
}

/**
 * Resposta da API para workspace individual
 */
export interface WorkspaceResponse {
  workspace: Workspace;
}
