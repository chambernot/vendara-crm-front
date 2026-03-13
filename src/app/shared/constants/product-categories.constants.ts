/**
 * Categorias predefinidas para produtos da vitrine
 * Garante consistência nos dados e facilita filtros
 */
export const PRODUCT_CATEGORIES = [
  'Anéis',
  'Colares',
  'Brincos',
  'Pulseiras',
  'Correntes',
  'Conjuntos',
  'Pingentes',
  'Tornozeleiras',
  'Alianças',
  'Piercing'
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];
