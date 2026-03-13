export const WORKSPACE_STORAGE_KEYS = {
  WORKSPACES_LIST: 'vendara_workspaces_v1',
  ACTIVE_WORKSPACE: 'vendara_workspace_active_v1',
} as const;

/**
 * Gera chave de storage namespaced por workspace
 * @param workspaceId ID do workspace
 * @param baseKey Chave base (ex: 'clients_v1')
 * @returns Chave completa (ex: 'vendara:ws123:clients_v1')
 */
export function keyFor(workspaceId: string, baseKey: string): string {
  return `vendara:${workspaceId}:${baseKey}`;
}

/**
 * Chaves antigas (sem workspace) para migração
 */
export const LEGACY_KEYS = {
  CLIENTS: 'vendara_clients_v1',
  PRODUCTS: 'vendara_products_v1',
  CONSIGNATIONS: 'vendara_consignations_v1',
} as const;
