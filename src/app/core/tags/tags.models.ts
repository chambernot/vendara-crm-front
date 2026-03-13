/**
 * Categoria da tag
 */
export type TagCategory = 'intencao' | 'status' | 'comportamento';

/**
 * Definição de uma tag do sistema
 */
export interface TagDefinition {
  id: string;
  slug: string; // identificador único (ex: 'vip', 'negociando')
  label: string; // Nome amigável (ex: 'VIP', 'Negociando')
  category: TagCategory;
  scoreImpact: number; // Impacto no score: positivo aumenta, negativo diminui
  color: string; // Cor do chip (tailwind class)
  description?: string; // Descrição opcional
}

/**
 * Tag aplicada a um cliente (referência)
 */
export interface AppliedTag {
  slug: string; // Referência ao slug da TagDefinition
  appliedAt: string; // ISO string
}
