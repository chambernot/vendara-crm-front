# 💎 Vitrine de Joias - Layout Moderno com TailwindCSS

## 📋 Visão Geral

Vitrine pública moderna e comercial para exposição de produtos (joias), construída com Angular standalone components e TailwindCSS.

## 🎨 Características

- **Design Minimalista e Premium** - Layout limpo focado nos produtos
- **Responsivo** - Adaptado para mobile, tablet e desktop
- **Performance** - OnPush change detection, lazy loading de imagens, trackBy
- **Busca em tempo real** - Filtro com debounce de 300ms
- **WhatsApp Integration** - Call-to-action principal
- **Produtos Relacionados** - Sugestões baseadas em categoria

## 📁 Estrutura de Arquivos

```
src/app/features/vitrine/
├── components/
│   ├── header.component.ts           # Header fixo com busca e botão WhatsApp
│   ├── product-card.component.ts     # Card individual de produto
│   ├── product-grid.component.ts     # Grid responsivo + skeleton loading
│   └── index.ts
├── pages/
│   ├── vitrine.component.ts          # Página de listagem (grid)
│   ├── produto-detalhe.component.ts  # Página de detalhes do produto
│   ├── vitrine-list.page.ts          # (antiga - pode ser removida)
│   └── vitrine-detail.page.ts        # (antiga - pode ser removida)
├── services/
│   ├── vitrine.service.ts            # Serviço principal com lógica de negócio
│   └── index.ts
├── data-access/
│   └── vitrine-api.service.ts        # Comunicação com API REST
└── vitrine.routes.ts                 # Rotas públicas
```

## 🧩 Componentes

### HeaderComponent
Header fixo com logo, busca e botão WhatsApp.

**Inputs:**
- `titulo: string` - Título da loja
- `subtitulo: string` - Subtítulo opcional
- `buscaAtual: string` - Valor atual da busca

**Outputs:**
- `buscaChange: string` - Emite quando usuário digita
- `whatsappClick: void` - Emite quando clica no botão WhatsApp

---

### ProductCardComponent
Card individual de produto com hover effects.

**Inputs:**
- `produto: Produto` (required)

**Outputs:**
- `cardClick: Produto` - Emite quando clica no card
- `whatsappClick: Produto` - Emite quando clica no botão WhatsApp

**Features:**
- Badge de disponibilidade (verde/cinza)
- Hover com overlay + botão "Ver detalhes"
- Imagem lazy loading
- Preço formatado em BRL
- Tags de categoria e material

---

### ProductGridComponent
Grid responsivo com skeleton loading e empty state.

**Inputs:**
- `produtos: Produto[]` (required)
- `loading: boolean`
- `mensagemVazia: string`
- `submensagemVazia: string`

**Outputs:**
- `produtoClick: Produto`
- `whatsappClick: Produto`

**Layout:**
- Desktop: 4 colunas
- Tablet: 2 colunas
- Mobile: 2 colunas
- Gap: 6 (1.5rem)

---

## 📄 Páginas

### VitrineComponent (Listagem)
Página principal com grid de produtos.

**Features:**
- Busca com debounce (300ms)
- Filtro por nome, descrição, categoria, material e tags
- Loading skeleton com 8 placeholders
- Empty state customizável
- Error state com retry

**URL:** `/vitrine/:workspaceSlug`

---

### ProdutoDetalheComponent
Página de detalhes do produto.

**Features:**
- Layout 2 colunas (imagem + info)
- Imagem grande com rounded-3xl
- Informações completas (preço, categoria, material, descrição, tags)
- Botão WhatsApp grande e destacado
- Seção "Você também pode gostar" (até 4 produtos da mesma categoria)
- Scroll suave ao trocar produto

**URL:** `/vitrine/:workspaceSlug/:productId`

---

## 🔧 Serviços

### VitrineService
Serviço principal com lógica de negócio.

**Métodos:**
```typescript
getProdutos(workspaceSlug: string): Observable<Produto[]>
getProduto(workspaceSlug: string, produtoId: string): Observable<Produto>
formatarPreco(preco: number): string
obterLinkWhatsApp(produto: Produto, vitrineUrl: string): string
chamarNoWhatsApp(produto: Produto, vitrineUrl: string): void
```

**Mapeia** `PublicProduct` (API) → `Produto` (interface do projeto)

---

## 📦 Modelo de Dados

```typescript
interface Produto {
  id: string;
  nome: string;
  descricao?: string;
  preco: number;
  imagens: string[];      // Lista de URLs das imagens
  categoria: string;       // Ex: "Anel", "Colar", "Brinco"
  material?: string;       // Ex: "Ouro 18k", "Prata 925"
  disponivel: boolean;     // true = em estoque
  tags?: string[];         // Tags adicionais
}
```

---

## 🎨 Design System (TailwindCSS)

### Cores Principais
- **Fundo:** `bg-gray-50` (#f8f9fb)
- **Cards:** `bg-white`
- **Primária:** `purple-600` (preços, CTAs)
- **Sucesso:** `green-500` (WhatsApp, disponível)
- **Texto:** `gray-900` (títulos), `gray-600` (secundário)

### Bordas e Sombras
- Cards: `rounded-2xl shadow-sm hover:shadow-xl`
- Imagens: `rounded-3xl` (detalhes), `aspect-square`
- Botões: `rounded-xl shadow-md`

### Responsividade
```css
/* Mobile First */
grid-cols-2           /* 2 colunas no mobile */
lg:grid-cols-4        /* 4 colunas no desktop */
```

### Transições
```css
transition-all duration-200
hover:scale-105
hover:shadow-xl
```

---

## 🚀 Como Usar

### 1. Adicionar à Rota Principal

No `app.routes.ts`:

```typescript
{
  path: 'vitrine',
  loadChildren: () => import('./features/vitrine/vitrine.routes').then(m => m.VITRINE_ROUTES)
}
```

### 2. Acessar a Vitrine

```
https://seusite.com/vitrine/:workspaceSlug
https://seusite.com/vitrine/joalheria-exemplo
```

### 3. Personalizar

**Header:**
```typescript
// vitrine.component.ts
<app-header
  [titulo]="'Minha Joalheria'"
  [subtitulo]="'Coleção Premium 2026'"
  ...
/>
```

**WhatsApp:**
```typescript
// vitrine.service.ts
const telefone = '5511999999999'; // Seu número
```

---

## ✨ Boas Práticas Implementadas

✅ **Angular Standalone Components**
✅ **ChangeDetectionStrategy.OnPush** - Performance otimizada
✅ **Signals** - Reatividade moderna
✅ **trackBy** - Evita re-renders desnecessários
✅ **Lazy Loading** - Imagens carregadas sob demanda
✅ **Debounce** - Busca otimizada (300ms)
✅ **Computed Signals** - Filtros reativos
✅ **Type Safety** - Interfaces tipadas
✅ **Responsive Design** - Mobile-first
✅ **Accessibility** - Alt texts, disabled states

---

## 🎯 Próximos Passos (Opcionais)

- [ ] Adicionar galeria de imagens (múltiplas fotos por produto)
- [ ] Implementar filtros por categoria/material (sidebar)
- [ ] Adicionar paginação ou infinite scroll
- [ ] Implementar compartilhamento social (Instagram, Facebook)
- [ ] Analytics (Google Analytics, Meta Pixel)
- [ ] SEO (meta tags dinâmicas por produto)
- [ ] PWA (tornar instalável no mobile)

---

## 📝 Notas

- A vitrine é **pública** e não requer autenticação
- A API deve estar configurada em `environment.apiBaseUrl`
- O endpoint usado é: `GET /public/catalog/:workspaceSlug`
- As imagens devem estar acessíveis publicamente

---

## 🐛 Troubleshooting

**Produtos não aparecem:**
1. Verifique se a API está rodando
2. Confirme o `workspaceSlug` na URL
3. Abra o DevTools e veja console/network

**Imagens quebradas:**
1. Verifique se `photoUrl` está correto na API
2. Confirme CORS configurado no backend
3. Use placeholder padrão no `vitrine.service.ts`

**Busca não funciona:**
1. Verifique se o debounce está sendo aplicado
2. Confirme que `termoBusca` está sendo atualizado

---

## 👨‍💻 Desenvolvedor

Implementado com Angular 16+, TailwindCSS e amor 💜

**Stack:**
- Angular Standalone
- TailwindCSS
- RxJS
- TypeScript
