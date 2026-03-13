# Sistema de Tracking da Vitrine

## Visão Geral

O sistema de tracking da vitrine registra o comportamento dos usuários enquanto navegam pela loja virtual (vitrine). Todos os eventos são armazenados no **localStorage** do navegador, organizados por workspace.

## Características

- ✅ **Sem dependência de autenticação**: Funciona para visitantes anônimos
- ✅ **Armazenamento local**: Dados salvos no navegador do usuário
- ✅ **Limites automáticos**: Mantém apenas os últimos 500 eventos por workspace
- ✅ **Falha silenciosa**: Erros de tracking não afetam a experiência do usuário
- ✅ **Privacy-friendly**: Sem cookies de terceiros ou rastreamento externo

## Eventos Rastreados

### 1. Home Acessada
**Tipo:** `home_aberto`  
**Quando:** Usuário acessa a página inicial da vitrine  
**Dados:** workspace slug

### 2. Catálogo Acessado
**Tipo:** `catalogo_aberto`  
**Quando:** Usuário acessa a página de catálogo/listagem  
**Dados:** workspace slug

### 3. Produto Visualizado
**Tipo:** `produto_visualizado`  
**Quando:** Usuário abre a página de detalhes de um produto  
**Dados:**
- `productId`: ID do produto
- `productName`: Nome do produto
- `meta.categoria`: Categoria do produto
- `meta.preco`: Preço do produto

### 4. Clique no WhatsApp
**Tipo:** `produto_whatsapp_click`  
**Quando:** Usuário clica em "Pedir WhatsApp" de qualquer produto  
**Dados:**
- `productId`: ID do produto
- `productName`: Nome do produto
- `meta.origem`: Onde o clique ocorreu (`home`, `catalogo`, `detalhes`, `relacionados`)
- `meta.preco`: Preço do produto

### 5. Produto Favoritado
**Tipo:** `produto_favoritado`  
**Quando:** Usuário adiciona um produto aos favoritos  
**Dados:**
- `productId`: ID do produto
- `productName`: Nome do produto

### 6. Produto Desfavoritado
**Tipo:** `produto_desfavoritado`  
**Quando:** Usuário remove um produto dos favoritos  
**Dados:**
- `productId`: ID do produto
- `productName`: Nome do produto

### 7. Busca Realizada
**Tipo:** `busca_realizada`  
**Quando:** Usuário realiza uma busca no catálogo  
**Dados:**
- `meta.termo`: Termo de busca digitado

## Estrutura de Evento

```typescript
interface VitrineEvent {
  id: string;              // ID único do evento
  type: VitrineEventType;  // Tipo do evento (veja lista acima)
  timestamp: string;       // Data/hora ISO 8601
  workspaceSlug: string;   // Identificador do workspace
  productId?: string;      // ID do produto (quando aplicável)
  productName?: string;    // Nome do produto (quando aplicável)
  meta?: Record<string, string | number | boolean>; // Dados adicionais
}
```

## API do Serviço

### `VitrineTrackingService`

#### Métodos Principais

##### `track(type, workspaceSlug, data?)`
Registra um novo evento de tracking.

```typescript
trackingService.track(
  'produto_visualizado',
  'minha-joalheria',
  {
    productId: '123',
    productName: 'Anel de Ouro',
    meta: {
      categoria: 'Anéis',
      preco: 1500
    }
  }
);
```

##### `getEvents(workspaceSlug, limit?)`
Retorna os eventos de um workspace (padrão: 100 mais recentes).

```typescript
const eventos = trackingService.getEvents('minha-joalheria', 50);
// Retorna os 50 eventos mais recentes, ordenados do mais novo para o mais antigo
```

##### `getStats(workspaceSlug, days?)`
Retorna estatísticas agregadas dos últimos N dias (padrão: 7).

```typescript
const stats = trackingService.getStats('minha-joalheria', 30);

// Retorna:
// {
//   total: 342,
//   byType: [
//     { type: 'produto_visualizado', count: 150 },
//     { type: 'produto_whatsapp_click', count: 45 },
//     ...
//   ],
//   produtosMaisVistos: [
//     { productId: '123', productName: 'Anel de Ouro', count: 25 },
//     { productId: '456', productName: 'Colar Prata', count: 18 },
//     ...
//   ]
// }
```

##### `clear(workspaceSlug)`
Remove todos os eventos de um workspace.

```typescript
trackingService.clear('minha-joalheria');
```

##### `export(workspaceSlug)`
Exporta todos os eventos como JSON formatado.

```typescript
const json = trackingService.export('minha-joalheria');
console.log(json);
// ou
downloadAsFile(json, 'tracking-data.json');
```

## Armazenamento LocalStorage

### Chave de Armazenamento
Os eventos são salvos com a chave:
```
vendara_vitrine_tracking_{workspaceSlug}
```

Exemplo:
- `vendara_vitrine_tracking_joiasexclusivas`
- `vendara_vitrine_tracking_vendara-oficial`

### Limites
- **Máximo de eventos por workspace:** 500
- Quando o limite é atingido, eventos mais antigos são removidos automaticamente
- Cada workspace tem seu próprio storage independente

## Uso nos Componentes

### Exemplo: Produto Detalhe

```typescript
export class ProdutoDetalheComponent {
  private trackingService = inject(VitrineTrackingService);

  carregarProduto(): void {
    this.vitrineService.getProduto(this.workspaceSlug, this.produtoId).subscribe({
      next: (produto) => {
        this.produto.set(produto);
        
        // Registrar visualização
        this.trackingService.track(
          'produto_visualizado',
          this.workspaceSlug,
          {
            productId: produto.id,
            productName: produto.nome,
            meta: {
              categoria: produto.categoria || '',
              preco: produto.preco
            }
          }
        );
      }
    });
  }
}
```

## Análise de Dados

### Insights Disponíveis

1. **Produtos Mais Vistos**: Quais produtos têm mais visualizações
2. **Taxa de Conversão WhatsApp**: Relação entre visualizações e cliques no WhatsApp
3. **Produtos Mais Favoritados**: Itens salvos pelos usuários
4. **Padrões de Navegação**: Home → Catálogo → Detalhes
5. **Termos de Busca Populares**: O que os usuários estão procurando

### Exemplo de Análise

```typescript
const stats = trackingService.getStats('minha-joalheria', 30);

// Taxa de conversão WhatsApp
const visualizacoes = stats.byType.find(t => t.type === 'produto_visualizado')?.count || 0;
const whatsappClicks = stats.byType.find(t => t.type === 'produto_whatsapp_click')?.count || 0;
const taxaConversao = (whatsappClicks / visualizacoes * 100).toFixed(2);

console.log(`Taxa de Conversão WhatsApp: ${taxaConversao}%`);

// Produto campeão
const maisVisto = stats.produtosMaisVistos[0];
console.log(`Produto Mais Visto: ${maisVisto.productName} (${maisVisto.count} visualizações)`);
```

## Privacidade e LGPD

- ✅ Dados armazenados localmente no navegador do usuário
- ✅ Sem envio de dados para servidores externos
- ✅ Usuário tem controle total (pode limpar localStorage)
- ✅ Sem identificação pessoal (PII)
- ✅ Sem cookies de terceiros ou rastreadores externos

## Próximos Passos (Opcional)

Evoluções possíveis para o sistema de tracking:

1. **Dashboard de Analytics**: Criar uma página admin para visualizar estatísticas
2. **Exportação de Relatórios**: Download de CSV/Excel com métricas
3. **Sincronização com Backend**: Enviar eventos para API para análise centralizada
4. **Heatmaps**: Visualizar onde usuários clicam mais
5. **Funil de Conversão**: Análise do caminho até a compra
6. **Testes A/B**: Comparar versões de páginas

## Troubleshooting

### Eventos não são salvos
- Verificar se localStorage está habilitado no navegador
- Verificar console do navegador para erros
- Testar em modo anônimo (pode ter restrições)

### Muitos eventos antigos
- Use `clear()` para limpar dados antigos
- Reduza o limite de eventos modificando `MAX_EVENTS`

### Dados inconsistentes
- Events são salvos de forma independente por workspace
- Limpar cache do navegador remove todos os eventos
