# Implementação: Fluxo Login > Onboarding > Workspace Select com API/Mongo

## ✅ Mudanças Implementadas

### 1. **WorkspaceService** - Integração com API
**Arquivo**: `src/app/core/workspace/workspace.service.ts`

Métodos atualizados:
- `list()`: Observable<Workspace[]> - Carrega workspaces via GET /api/workspaces
- `create(name)`: Observable<Workspace> - Cria workspace via POST /api/workspaces
- `select(workspace)`: void - Salva workspace completo no localStorage e registra telemetria
- `getActive()`: Workspace | null - Retorna workspace ativo (com retrocompatibilidade)
- `setActive()`: Deprecado em favor de `select()`

### 2. **Workspace Models**
**Arquivo**: `src/app/core/workspace/workspace.models.ts`

Interfaces adicionadas:
```typescript
interface Workspace {
  id: string;
  name: string;
  slug?: string;        // Novo: para uso em URLs/headers
  createdAt: string;
  ownerId?: string;     // Novo: ID do proprietário
}

interface CreateWorkspaceDto { name: string; }
interface WorkspaceListResponse { workspaces: Workspace[]; }
interface WorkspaceResponse { workspace: Workspace; }
```

### 3. **WorkspaceInterceptor**
**Arquivo**: `src/app/core/workspace/workspace.interceptor.ts` (NOVO)

Funcionalidade:
- Injeta header `x-workspace-id` (ou `x-workspace-slug`) em todas as chamadas `/api/*`
- Ignora rotas públicas e rotas que não exigem workspace (`/api/workspaces`)
- Logs detalhados para debug

**Ordem dos interceptors** no `app.config.ts`:
1. `authInterceptor` (injeta x-api-key ou Bearer token)
2. `workspaceInterceptor` (injeta x-workspace-id)
3. `whatsappApiInterceptor`

### 4. **AuthInterceptor** - Limpeza
**Arquivo**: `src/app/core/api/auth.interceptor.ts`

Removido:
- ❌ Lógica de injeção de `x-workspace-id` (movida para WorkspaceInterceptor)
- ❌ Dependência do WorkspaceService

Mantido:
- ✅ Injeção de `x-api-key` em desenvolvimento
- ✅ Injeção de `Bearer token` em produção

### 5. **Login Page** - Verificação de Workspaces
**Arquivo**: `src/app/features/auth/pages/login/login.page.ts`

Fluxo atualizado:
1. Usuário faz login
2. Verifica se completou onboarding → Não: `/onboarding`
3. Verifica se tem workspaces via API:
   - Sem workspaces → `/onboarding`
   - Com workspaces → `/workspace/select`

### 6. **Onboarding Page** - Criação de Workspace
**Arquivo**: `src/app/features/onboarding/pages/onboarding/onboarding.page.ts`

Fluxo atualizado:
1. Usuário completa os 3 passos
2. Salva dados do onboarding no AuthService
3. **Cria workspace via API** (nome: "Meu Ambiente")
4. Navega para `/workspace/select`
5. Loading spinner e tratamento de erros

### 7. **Workspace Select Page** - Carregamento da API
**Arquivo**: `src/app/features/workspace/pages/workspace-select/workspace-select.page.ts`

Funcionalidades:
- Carrega lista de workspaces via `workspaceService.list()`
- Permite criar novo workspace via `workspaceService.create()`
- Ao selecionar: chama `workspaceService.select()` e redireciona para `/app/central`
- Loading states e mensagens de erro
- Retry automático em caso de erro

### 8. **WorkspaceGuard**
**Arquivo**: `src/app/core/workspace/workspace.guard.ts`

Status: ✅ Já estava correto
- Verifica se há workspace ativo
- Redireciona para `/workspace/select` se não houver

---

## 🔄 Fluxo Completo

### Primeiro Acesso (Novo Usuário)
```
1. /auth/login → POST /api/auth/login
   ↓ { onboardingComplete: false, hasWorkspaces: false }
   ↓
2. /onboarding (3 passos)
   ↓
3. POST /api/onboarding/complete (salvar respostas)
   ↓
4. POST /api/workspaces (criar "Meu Ambiente")
   ↓
5. /workspace/select (mostra workspace criado)
   ↓
6. Usuário seleciona → salva no localStorage
   ↓
7. /app/central (com x-workspace-id nos headers)
```

### Usuário Existente Sem Workspaces
```
1. /auth/login → POST /api/auth/login
   ↓ { onboardingComplete: true, hasWorkspaces: false }
   ↓
2. /onboarding (rápido, apenas criar workspace)
   ↓
3. POST /api/workspaces
   ↓
4. /workspace/select
```

### Usuário Completo
```
1. /auth/login → POST /api/auth/login
   ↓ { onboardingComplete: true, hasWorkspaces: true }
   ↓
2. /workspace/select → GET /api/workspaces
   ↓
3. Usuário seleciona workspace
   ↓
4. /app/central
```

### Navegação Protegida
```
Qualquer rota /app/*
   ↓
workspaceGuard verifica workspace ativo
   ↓
   Não tem? → /workspace/select
   Tem? → Permite acesso
```

---

## 📡 Headers HTTP

Todas as requisições para `/api/*` (exceto públicas e `/api/workspaces`) terão:

**Desenvolvimento:**
```
x-api-key: dev_api_key_12345
x-workspace-id: ws_1234567890_abc123xyz
Accept: application/json
Content-Type: application/json (POST/PUT/PATCH)
```

**Produção:**
```
Authorization: Bearer <jwt_token>
x-workspace-id: ws_1234567890_abc123xyz
```

---

## 🗂️ Storage

**Workspace Ativo:**
```javascript
// localStorage key: 'jewelcrm_workspace_active_v1'
{
  "id": "ws_1234567890_abc123xyz",
  "name": "Meu Ambiente",
  "slug": "meu-ambiente",
  "createdAt": "2026-02-07T12:00:00.000Z",
  "ownerId": "user_123"
}
```

---

## 🧹 Limpeza de Código Legado

- ❌ Removida lista local de workspaces (`jewelcrm_workspaces_v1`)
- ❌ Migração automática desabilitada (agora workspaces vêm da API)
- ✅ Retrocompatibilidade mantida no `getActive()` para IDs antigos

---

## 🎯 Endpoints da API Esperados

### POST /api/auth/login
Autentica ou cria usuário
```json
// Request
{
  "email": "usuario@example.com"
}

// Response
{
  "token": "jwt_token_aqui",
  "user": {
    "id": "user_123",
    "email": "usuario@example.com",
    "name": "Usuario"
  },
  "onboardingComplete": false,  // Se usuário completou onboarding
  "hasWorkspaces": false        // Se usuário tem workspaces
}
```

### POST /api/onboarding/complete
Salva dados do onboarding do usuário
```json
// Request
{
  "businessType": "loja",
  "products": ["ouro", "prata"],
  "objective": "vender_mais",
  "completedAt": "2026-02-07T12:00:00.000Z"
}

// Response
204 No Content ou { "success": true }
```

### GET /api/workspaces
Retorna lista de workspaces do usuário
```json
{
  "workspaces": [
    {
      "id": "ws_123",
      "name": "Meu Ambiente",
      "slug": "meu-ambiente",
      "createdAt": "2026-02-07T12:00:00.000Z"
    }
  ]
}
```

### POST /api/workspaces
Cria novo workspace
```json
// Request
{ "name": "Meu Ambiente" }

// Response
{
  "workspace": {
    "id": "ws_123",
    "name": "Meu Ambiente",
    "slug": "meu-ambiente",
    "createdAt": "2026-02-07T12:00:00.000Z"
  }
}
```

---

## ✅ Testes Recomendados

1. **Login de novo usuário:**
   - Login → Onboarding → Criar workspace → Selecionar → App

2. **Login de usuário existente sem workspaces:**
   - Login → Onboarding → Criar workspace → Selecionar

3. **Login de usuário com workspaces:**
   - Login → Selecionar workspace → App

4. **Criar workspace adicional:**
   - /workspace/select → Criar novo → Selecionar → App

5. **Trocar de workspace:**
   - App → Voltar para /workspace/select → Selecionar outro → App

6. **Tentar acessar app sem workspace:**
   - WorkspaceGuard deve redirecionar para /workspace/select

---

## 🐛 Debug

Logs habilitados em:
- `[AUTH]` - AuthInterceptor
- `[WORKSPACE]` - WorkspaceInterceptor
- WorkspaceService (console.log)
- Páginas (console.log/error)

Para verificar headers:
```javascript
// DevTools → Network → Qualquer chamada /api/* → Headers
x-api-key: dev_api_key_12345
x-workspace-id: ws_...
```

---

## 📝 Notas Importantes

1. **Ordem dos Interceptors**: AuthInterceptor ANTES de WorkspaceInterceptor
2. **Rotas sem workspace**: `/api/workspaces` não recebe x-workspace-id
3. **Retrocompatibilidade**: `getActive()` suporta formato antigo (string ID)
4. **Telemetria**: Evento `workspace_selected` registrado ao selecionar
5. **Navegação**: Central é `/app/central` (não `/app/dashboard`)
