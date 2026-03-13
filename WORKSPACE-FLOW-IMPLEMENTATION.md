# Implementação do Fluxo de Workspace - JewelCRM

## 📋 Visão Geral

Sistema completo de gestão de workspaces implementado no JewelCRM, garantindo que cada usuário tenha contexto isolado e que todas as requisições sejam vinculadas ao workspace correto.

## 🏗️ Arquitetura Implementada

### 1. **Interfaces e Models**

#### User Model ([user.model.ts](src/app/core/auth/models/user.model.ts))
```typescript
interface User {
  id: string;
  email: string;
  name?: string;
  defaultWorkspaceId?: string; // ✨ NOVO: ID do workspace padrão
}

interface AuthResponse {
  token: string;
  user: User;
  onboardingComplete?: boolean;
  hasWorkspaces?: boolean;
  defaultWorkspaceId?: string; // ✨ Atalho para user.defaultWorkspaceId
}
```

#### Workspace Model ([workspace.models.ts](src/app/core/workspace/workspace.models.ts))
```typescript
interface Workspace {
  id: string;
  name: string;
  slug?: string;
  createdAt: string;
  ownerId?: string;
}
```

### 2. **WorkspaceService** ([workspace.service.ts](src/app/core/workspace/workspace.service.ts))

Métodos implementados:
- ✅ `getWorkspaces(): Observable<Workspace[]>` - Lista workspaces via GET /api/workspaces
- ✅ `createWorkspace(name): Observable<Workspace>` - Cria workspace via POST /api/workspaces
- ✅ `selectWorkspace(id): Observable<void>` - Notifica backend via POST /api/workspaces/{id}/select
- ✅ `setCurrentWorkspace(id)` - Salva currentWorkspaceId no localStorage
- ✅ `getCurrentWorkspaceId()` - Retorna ID do workspace atual
- ✅ `select(workspace)` - Salva workspace completo no storage
- ✅ `getActive()` - Retorna workspace ativo completo
- ✅ `clearActive()` - Limpa workspace do storage

**Persistência:**
- `localStorage.currentWorkspaceId` - ID do workspace atual (usado pelo interceptor)
- `localStorage.activeWorkspace` - Objeto Workspace completo (para UI)

### 3. **Login Flow** ([login.page.ts](src/app/features/auth/pages/login/login.page.ts))

Fluxo após login bem-sucedido:

```typescript
1. Receber AuthResponse do backend
2. Verificar user.defaultWorkspaceId ou authResponse.defaultWorkspaceId
3. Se tem defaultWorkspaceId:
   ✅ workspaceService.setCurrentWorkspace(defaultWorkspaceId)
   ✅ Navegar para /app/central
4. Se não tem defaultWorkspaceId:
   → Se onboardingComplete = false → /onboarding
   → Se hasWorkspaces = false → /onboarding
   → Caso contrário → /workspace/select
```

### 4. **Workspace Interceptor** ([workspace.interceptor.ts](src/app/core/workspace/workspace.interceptor.ts))

**Funcionalidades:**
- ✅ Adiciona header `x-workspace-id` em todas requisições `/api/*`
- ✅ Exclui rotas que não precisam de workspace:
  - `/api/auth/login`
  - `/api/auth/register`
  - `/api/auth/status`
  - `/api/workspaces` (lista e criação)
  - `/api/onboarding`
- ✅ Trata erros 400/403 relacionados a workspace:
  - Detecta mensagens com palavras "workspace" ou "ambiente"
  - Limpa workspace do storage
  - Redireciona para `/workspace/select`

### 5. **Workspace Select** ([workspace-select.page.ts](src/app/features/workspace/pages/workspace-select/workspace-select.page.ts))

**Ao carregar página:**
```typescript
GET /api/workspaces → Exibe lista de workspaces
```

**Ao selecionar workspace:**
```typescript
1. POST /api/workspaces/{id}/select
2. workspaceService.select(workspace)
3. Navegar para /app/central
```

**Ao criar workspace:**
```typescript
1. POST /api/workspaces { name }
2. Receber workspace criado
3. POST /api/workspaces/{id}/select
4. workspaceService.select(workspace)
5. Navegar para /app/central
```

### 6. **Onboarding Flow** ([onboarding.page.ts](src/app/features/onboarding/pages/onboarding/onboarding.page.ts))

**Ao completar onboarding:**
```typescript
1. POST /api/onboarding/complete { businessType, products, objective }
2. POST /api/workspaces { name: "Meu Ambiente" }
3. Receber workspace criado
4. POST /api/workspaces/{id}/select
5. workspaceService.select(workspace)
6. Navegar para /app/central
```

### 7. **Workspace Guard** ([workspace.guard.ts](src/app/core/workspace/workspace.guard.ts))

Protege rotas `/app/*`:
```typescript
1. Verificar se existe currentWorkspaceId
2. Se não existe → Redirecionar para /workspace/select
3. Se existe → Permitir acesso
```

**Aplicado em:** [app.routes.ts](src/app/features/app/app.routes.ts)
```typescript
{
  path: '',
  canMatch: [onboardingGuard, workspaceGuard],
  loadComponent: () => import('./app-shell.component')
}
```

## 🔄 Fluxos Completos

### Fluxo 1: Login com Workspace Padrão
```
Login → user.defaultWorkspaceId existe
  ↓
setCurrentWorkspace(defaultWorkspaceId)
  ↓
/app/central (workspaceGuard ✅)
  ↓
Todas requisições com header x-workspace-id
```

### Fluxo 2: Login sem Workspace (Onboarding Completo)
```
Login → hasWorkspaces = true, sem defaultWorkspaceId
  ↓
/workspace/select
  ↓
Usuário seleciona workspace
  ↓
POST /api/workspaces/{id}/select
  ↓
setCurrentWorkspace(id)
  ↓
/app/central
```

### Fluxo 3: Login sem Onboarding
```
Login → onboardingComplete = false
  ↓
/onboarding (wizard 3 etapas)
  ↓
POST /api/onboarding/complete
  ↓
POST /api/workspaces { name: "Meu Ambiente" }
  ↓
POST /api/workspaces/{id}/select
  ↓
setCurrentWorkspace(id)
  ↓
/app/central
```

### Fluxo 4: Erro de Workspace
```
Requisição → 400/403 com mensagem "workspace"
  ↓
Interceptor detecta erro
  ↓
clearActive() + remove currentWorkspaceId
  ↓
Redirecionar /workspace/select
```

## 📦 APIs Esperadas no Backend

### Autenticação
```typescript
POST /api/auth/login
Body: { email: string }
Response: {
  token: string,
  user: { id, email, name?, defaultWorkspaceId? },
  onboardingComplete?: boolean,
  hasWorkspaces?: boolean
}
```

### Workspaces
```typescript
GET /api/workspaces
Response: { workspaces: Workspace[] }

POST /api/workspaces
Body: { name: string }
Response: { workspace: Workspace }

POST /api/workspaces/{id}/select
Response: void (200 OK)
```

### Onboarding
```typescript
POST /api/onboarding/complete
Body: { businessType, products, objective, completedAt }
Response: void (200 OK)
```

### Requisições de Domínio
Todas as requisições de domínio (clientes, produtos, vendas, etc.) devem:
- Receber header `x-workspace-id`
- Validar workspace do usuário
- Retornar 400/403 se workspace inválido

## ✅ Checklist de Implementação

- [x] Interface User com defaultWorkspaceId
- [x] Interface AuthResponse com defaultWorkspaceId
- [x] WorkspaceService.getWorkspaces()
- [x] WorkspaceService.createWorkspace()
- [x] WorkspaceService.selectWorkspace()
- [x] WorkspaceService.setCurrentWorkspace()
- [x] WorkspaceService.getCurrentWorkspaceId()
- [x] Login flow verifica defaultWorkspaceId
- [x] Login redireciona corretamente baseado em workspace
- [x] Interceptor adiciona x-workspace-id
- [x] Interceptor trata erros de workspace
- [x] WorkspaceSelectComponent lista workspaces
- [x] WorkspaceSelectComponent chama selectWorkspace
- [x] WorkspaceSelectComponent cria e seleciona novo workspace
- [x] Onboarding cria workspace ao finalizar
- [x] Onboarding chama selectWorkspace
- [x] WorkspaceGuard protege rotas /app/*
- [x] WorkspaceGuard redireciona para /workspace/select

## 🎯 Resultado Final

O sistema agora garante que:

1. **Login automático:** Usuários com `defaultWorkspaceId` entram direto no app
2. **Contexto isolado:** Cada workspace tem dados separados
3. **Headers automáticos:** Todas requisições enviam `x-workspace-id`
4. **Recuperação de erro:** Erros de workspace redirecionam para seleção
5. **Guards efetivos:** Rotas protegidas exigem workspace ativo
6. **Onboarding completo:** Cria workspace automaticamente no final
7. **Seleção manual:** Usuário pode trocar de workspace quando necessário

## 🔧 Como Testar

1. **Limpar storage:** `localStorage.clear()` no console
2. **Fazer login:** Testar com/sem defaultWorkspaceId
3. **Verificar headers:** DevTools → Network → Ver x-workspace-id
4. **Testar onboarding:** Novo usuário deve criar workspace
5. **Testar seleção:** Múltiplos workspaces, trocar entre eles
6. **Testar guard:** Tentar acessar /app/central sem workspace
7. **Testar erro:** Backend retornar 403 → deve redirecionar

## 📝 Notas Importantes

- `currentWorkspaceId` no localStorage é a fonte de verdade para o interceptor
- `activeWorkspace` mantém objeto completo para UI (nome, slug, etc)
- Backend deve implementar validação de workspace em todas rotas de domínio
- Rotas públicas (`/api/auth/*`, `/api/workspaces`) não recebem header
- Erros de workspace limpam storage e forçam nova seleção
