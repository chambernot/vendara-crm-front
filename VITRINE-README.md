# 📱 Vitrine Pública de Produtos

Sistema de catálogo público para divulgação de produtos no WhatsApp.

## 🎯 Funcionalidades

- ✅ **Catálogo Público**: Vitrine de produtos acessível sem autenticação
- ✅ **Mobile-First**: Design responsivo otimizado para smartphones
- ✅ **Compartilhamento WhatsApp**: Botão para compartilhar produtos diretamente
- ✅ **Sem Estoque**: Badge visual para produtos sem estoque
- ✅ **Loading Skeleton**: Experiência de carregamento suave
- ✅ **Roteamento Público**: Rotas `/vitrine/:workspaceSlug` sem guard de autenticação

## 🚀 Como Usar

### 1. Acessar a Vitrine

```
https://seudominio.com/vitrine/{workspaceSlug}
```

Substitua `{workspaceSlug}` pelo identificador do workspace (ex: `joalheria-silva`).

### 2. Compartilhar Produto no WhatsApp

Cada card de produto tem um botão verde "Compartilhar no WhatsApp" que:
- Gera mensagem formatada com nome, preço e link
- Abre WhatsApp Web/App com mensagem pronta
- Permite que o vendedor escolha para quem enviar

### 3. Ver Detalhes do Produto

Clique no card para ver:
- Foto ampliada
- Tipo e material
- Preço destacado
- Botão "Chamar no WhatsApp" para contato direto

## 📁 Arquitetura

```
features/vitrine/
├── data-access/
│   ├── vitrine-api.service.ts   # Serviço de API pública
│   └── index.ts                 # Barrel exports
├── pages/
│   ├── vitrine-list.page.ts     # Lista de produtos (grid)
│   ├── vitrine-list.page.html
│   ├── vitrine-list.page.css
│   ├── vitrine-detail.page.ts   # Detalhe do produto
│   ├── vitrine-detail.page.html
│   └── vitrine-detail.page.css
├── vitrine.routes.ts            # Rotas públicas
└── index.ts                     # Barrel exports
```

## 🔌 API Endpoints

### GET /api/public/catalog/{workspaceSlug}

Lista todos os produtos públicos de um workspace.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_123",
      "name": "Anel de Ouro",
      "type": "Anel",
      "material": "Ouro 18k",
      "price": 850.00,
      "photoUrl": "https://...",
      "description": "Anel elegante...",
      "isOutOfStock": false
    }
  ]
}
```

### GET /api/public/catalog/{workspaceSlug}/{productId}

Obtém detalhes de um produto específico.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "prod_123",
    "name": "Anel de Ouro",
    ...
  }
}
```

## 🎨 Design System

### Cores

- **Primary**: `#667eea` (roxo/azul)
- **Success**: `#25d366` (verde WhatsApp)
- **Danger**: `#dc2626` (vermelho)
- **Background**: Gradiente `#667eea` → `#764ba2`

### Componentes

#### Product Card
- Imagem 280px altura
- Hover com elevação
- Badge "Sem estoque" condicional
- Botão WhatsApp verde

#### Loading Skeleton
- Animação shimmer suave
- 6 cards placeholder
- Classes: `skeleton`, `skeleton-image`, `skeleton-line`

#### Empty State
- Ícone emoji grande
- Mensagem amigável
- Fundo com gradiente

## 🔒 Segurança

- ✅ **Sem Autenticação**: Rotas `/api/public/` não exigem x-api-key
- ✅ **Interceptor Bypass**: auth.interceptor.ts ignora rotas públicas
- ✅ **Read-Only**: API pública apenas leitura (GET)
- ✅ **Workspace Isolation**: Produtos filtrados por workspaceSlug

## 📱 Responsividade

```css
/* Desktop */
grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));

/* Mobile (< 640px) */
grid-template-columns: 1fr;
```

## 🔗 Integração WhatsApp

### Mensagem Gerada

```
🌟 *{Nome do Produto}*

💎 Tipo: {Tipo}
✨ Material: {Material}
💰 Preço: R$ {Preço formatado}

📱 Veja mais detalhes:
{URL da vitrine}/{productId}
```

### Botão de Compartilhamento

```typescript
shareOnWhatsApp(product, vitrineUrl): void {
  const message = this.generateWhatsAppMessage(product, vitrineUrl);
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}
```

## ✅ Checklist de Deploy

- [ ] Backend: Implementar endpoints `/api/public/catalog/{slug}` e `/{slug}/{id}`
- [ ] Backend: Garantir que produtos retornam `isOutOfStock` baseado em `stock === 0`
- [ ] Backend: Adicionar índice no campo `workspaceSlug` para performance
- [ ] Frontend: Configurar environment.apiBaseUrl correto
- [ ] SEO: Adicionar meta tags Open Graph para compartilhamento
- [ ] Analytics: Instrumentar eventos de visualização e compartilhamento

## 🐛 Troubleshooting

### Produtos não carregam

1. Verificar se backend `/api/public/catalog/{slug}` está rodando
2. Checar console do navegador para erros de CORS
3. Confirmar que workspaceSlug está correto

### Botão WhatsApp não funciona

1. Verificar se navegador permite `window.open`
2. Testar URL gerada no console
3. Verificar se mensagem está codificada corretamente

### Imagens não aparecem

1. Confirmar que `photoUrl` não é `null` ou vazio
2. Verificar CORS do servidor de imagens
3. Placeholder funciona? `https://via.placeholder.com/400x400`

## 📄 Licença

Parte do sistema HcajoaIAs CRM - Uso interno.
