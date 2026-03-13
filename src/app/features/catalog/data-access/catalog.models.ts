export type ProductStatus = 'available' | 'consigned' | 'sold';

// Values must match backend: ANEL, COLAR, PULSEIRA, BRINCO, CORRENTE, OUTRO
export type ProductType = 'ANEL' | 'COLAR' | 'PULSEIRA' | 'BRINCO' | 'CORRENTE' | 'OUTRO';

// Values must match backend: OURO, PRATA, ACO, PEROLA, FOLHEADO, OUTRO
export type ProductMaterial = 'OURO' | 'PRATA' | 'ACO' | 'PEROLA' | 'FOLHEADO' | 'OUTRO';

/**
 * Imagem do produto (novo sistema de upload)
 */
export interface ProductImage {
  id: string;
  url: string;           // ex: "/api/products/abc/images/xyz/file"
  fileName: string;
  contentType: string;
  sizeBytes: number;
  order: number;
  uploadedAt: string;    // ISO 8601
}

/**
 * Resposta do upload de imagem
 */
export interface ProductImageUploadResponse {
  image: ProductImage;
  product: Product;
}

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  material: ProductMaterial;
  price: number;
  // MVP (API / Mongo)
  quantityAvailable: number;
  photoUrl?: string;      // URL da imagem de capa (order=0)
  images: ProductImage[]; // Array de todas as imagens
  notes?: string;
  active: boolean;
  updatedAt?: string;

  // Campos legados (mantidos para compatibilidade com outras features)
  status: ProductStatus;
  daysStopped: number;
  imageUrl?: string;
  sku?: string;
  description?: string;
  createdAt: string;

  // Campos estendidos para vitrine/e-commerce
  categoria?: string;      // Categoria livre (além do type)
  colecao?: string;        // Nome da coleção
  cor?: string;            // Cor do produto
  tamanho?: string;        // Tamanho do produto
  videoUrl?: string;       // URL do vídeo do produto
  maisVendido?: boolean;   // Flag: produto mais vendido
  novidade?: boolean;      // Flag: produto novidade
  promocao?: boolean;      // Flag: produto em promoção
}
