# 🛠️ Como Configurar a Vitrine para Funcionar

## ✅ O que foi corrigido

A vitrine agora busca produtos **diretamente do backend**, assim como a tela de catálogo faz.

**Alterações realizadas:**
- ✅ VitrineApiService atualizado para usar `/api/public/catalog/{workspaceSlug}`
- ✅ Mesma estrutura de chamada de API que o ProductService usa
- ✅ Suporte para resposta do Swagger: `{ workspace: {...}, products: [...] }`
- ✅ Logs detalhados para debug

---

## 📋 Pré-requisitos para a Vitrine Funcionar

### 1. **Backend rodando**
O backend ASP.NET Core precisa estar rodando na porta 5000:
```bash
# Verifique se o backend está rodando
curl http://localhost:5000/api/health
# ou
Invoke-WebRequest -Uri http://localhost:5000/api/health
```

### 2. **Workspace configurado**
O workspace `meu-ambiente` precisa existir no banco de dados MongoDB.

### 3. **Produtos cadastrados**
O workspace precisa ter produtos cadastrados e ativos.

---

## 🧪 Como Testar a Vitrine

### Passo 1: Verificar se o backend tem produtos públicos

Abra o navegador ou use curl/Postman:
```
GET http://localhost:5000/public/catalog/meu-ambiente
```

**Resposta esperada:**
```json
{
  "workspace": {
    "name": "Meu Ambiente",
    "slug": "meu-ambiente",
    "description": null,
    "logoUrl": null
  },
  "products": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "Anel de Ouro",
      "type": "ANEL",
      "material": "OURO",
      "price": 1500.00,
      "photoUrl": "https://...",
      "description": "Anel elegante...",
      "isOutOfStock": false
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 12,
  "totalPages": 1,
  "hasNextPage": false,
  "hasPreviousPage": false
}
```

Se retornar **404** ou **array vazio**, significa que:
- ❌ O workspace "meu-ambiente" não existe
- ❌ O workspace não tem produtos cadastrados
- ❌ Os produtos estão inativos (active: false)

### Passo 2: Cadastrar produtos (se necessário)

**Opção A: Via Interface (recomendado)**
1. Faça login no sistema
2. Acesse **Catálogo** → **Novo Produto**
3. Cadastre alguns produtos com fotos
4. Certifique-se de que estão **Ativos**

**Opção B: Via API Seed**
```bash
# No Swagger: POST /api/products/seed
# Headers:
# x-workspace-id: <seu_workspace_id>
# x-api-key: dev_api_key_12345
```

**Opção C: Via curl**
```bash
POST http://localhost:5000/api/products
Headers:
  x-workspace-id: <seu_workspace_id>
  x-api-key: dev_api_key_12345
  Authorization: Bearer <seu_token>
  Content-Type: application/json

Body:
{
  "name": "Anel Solitário",
  "type": "ANEL",
  "material": "OURO",
  "price": 2500.00,
  "quantityAvailable": 5,
  "photoUrl": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=400",
  "active": true
}
```

### Passo 3: Acessar a vitrine

```
http://localhost:4200/vitrine/meu-ambiente
```

---

## 🔍 Debugging

### Console do navegador

Abra as DevTools (F12) e veja os logs:

```
🌐 [Vitrine] Carregando catálogo público de: meu-ambiente
🌐 [Vitrine] URL completa: /api/public/catalog/meu-ambiente
🌐 [Vitrine] Esta rota NÃO requer autenticação nem workspace selecionado

✅ [Vitrine] Resposta recebida: { workspace: {...}, products: [...] }
```

### Erros comuns

**❌ Erro 404: Workspace não encontrado**
```
Catálogo não encontrado. Verifique o workspace.
```
**Solução:** Certifique-se de que o workspace "meu-ambiente" existe no MongoDB.

---

**❌ Erro 0: Não foi possível conectar**
```
Erro de conexão. Verifique se o backend está rodando.
```
**Solução:** Inicie o backend ASP.NET Core na porta 5000.

---

**❌ Erro 401: Unauthorized**
```
Vitrine indisponível: o backend está exigindo autenticação (401).
```
**Solução:** O endpoint `/public/catalog` não deve exigir autenticação. Verifique a configuração do backend.

---

**✅ Produtos carregados mas lista vazia**
```
Nenhum produto disponível
Em breve teremos novidades por aqui!
```
**Solução:** O workspace existe mas não tem produtos. Cadastre produtos via catálogo.

---

## 🔧 Configuração do Proxy (já configurada)

O arquivo `proxy.conf.json` já está configurado corretamente:

```json
{
  "/api/public": {
    "target": "http://localhost:5000",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug",
    "pathRewrite": {
      "^/api/public": "/public"
    }
  }
}
```

Isso significa:
- Frontend chama: `/api/public/catalog/meu-ambiente`
- Proxy reescreve para: `http://localhost:5000/public/catalog/meu-ambiente`

---

## 📱 URL da Vitrine

A vitrine é acessível em:
```
http://localhost:4200/vitrine/{workspaceSlug}
```

Exemplos:
- `http://localhost:4200/vitrine/meu-ambiente`
- `http://localhost:4200/vitrine/joalheria-silva`
- `http://localhost:4200/vitrine/loja-premium`

---

## 🚀 Próximos Passos

1. ✅ Inicie o backend (porta 5000)
2. ✅ Inicie o frontend Angular (`npm run start`)
3. ✅ Verifique se o workspace existe
4. ✅ Cadastre produtos no catálogo
5. ✅ Acesse `http://localhost:4200/vitrine/meu-ambiente`

---

## 📊 Estrutura da Resposta do Backend

```typescript
interface PublicCatalogResponseV2 {
  workspace: {
    name: string;
    slug: string;
    description?: string | null;
    logoUrl?: string | null;
  };
  products: Array<{
    id: string;
    name: string;
    type: string;
    material: string;
    price: number;
    photoUrl?: string | null;
    shortDescription?: string | null;
    description?: string | null;
    isOutOfStock: boolean;
  }>;
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}
```

---

## ✨ Funcionalidades da Vitrine

- 📱 **Mobile-First**: Design responsivo
- 🎨 **Loading Skeleton**: Carregamento suave
- 🔍 **Filtros**: Por tipo, material, busca
- 📤 **Compartilhar**: Botão WhatsApp em cada produto
- 🚫 **Sem Estoque**: Badge visual para produtos esgotados
- 🔗 **Deep Links**: URLs diretas para produtos específicos

---

**Dúvidas?** Verifique os logs no console do navegador (F12) para informações detalhadas sobre as requisições.
