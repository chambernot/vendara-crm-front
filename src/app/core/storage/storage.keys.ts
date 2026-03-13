/**
 * Storage keys para LocalStorage
 * Versão incluída para facilitar migração futura
 */
export const STORAGE_KEYS = {
  clients: 'vendara_clients_v1',
  products: 'vendara_products_v1',
  consignations: 'vendara_consignations_v1',
  suggestionApplications: 'vendara_suggestion_applications_v1'
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
