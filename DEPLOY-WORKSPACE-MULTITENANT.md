# Vendara - Deploy Multi-Tenant Workspace v1.3

## 📦 Informações do Pacote

**Data do Build:** 04 de Março de 2026  
**Versão:** 1.3.0 - Multi-Tenant Workspace  
**Pacote:** `vendara-production-workspace-20260304-205620.zip` (0.33 MB)  
**Ambiente:** Production (Otimizado)

---

## 🆕 Novidades desta Versão

### Arquitetura Multi-Tenant

Esta versão implementa suporte completo à nova arquitetura multi-tenant baseada em **workspace_users**:

#### 1. **Novo Endpoint de Workspaces**
- Endpoint: `GET /api/workspaces/my`
- Retorna workspaces do usuário com seus respectivos roles
- **Fallback automático**: Se o endpoint não estiver disponível (403/404), usa `/api/workspaces`

#### 2. **Suporte a Roles**
- Campo `role` adicionado ao modelo Workspace
- Interface exibe badge visual com role do usuário em cada workspace
- Roles suportados:
  - Proprietário (owner)
  - Administrador (admin)
  - Gerente (manager)
  - Usuário (user)
  - Membro (member)
  - Visualizador (viewer)

#### 3. **Fluxo de Login Inteligente**
Após autenticação, o sistema:
- Busca workspaces via `GET /api/workspaces/my`
- **1 workspace** → seleciona automaticamente e redireciona para dashboard
- **Múltiplos workspaces** → exibe tela de seleção com roles
- **0 workspaces** → redireciona para onboarding

#### 4. **Headers de Workspace**
- Todas requisições `/api/*` incluem header `x-workspace-id` automaticamente
- Workspace salvo em `localStorage.workspaceId` para persistência
- WorkspaceGuard protege rotas sem workspace selecionado

---

## 🔧 Configurações de Backend Requeridas

### Endpoint Obrigatório (já existe)
```
POST /api/workspaces/{id}/select
```

### Novo Endpoint (opcional - com fallback)
```
GET /api/workspaces/my
Response: [
  {
    id: string
    name: string
    role: string  // owner, admin, user, etc
  }
]
```

**Nota:** Se `/api/workspaces/my` não existir, o sistema automaticamente usa `/api/workspaces` (compatibilidade retroativa).

### Header Esperado pelo Backend
```
x-workspace-id: {workspaceId}
```

---

## 📁 Estrutura do Deploy

```
dist/vendara/browser/
├── index.html
├── styles-*.css
├── main-*.js
├── polyfills-*.js
└── chunk-*.js (lazy-loaded)
```

---

## 🚀 Instruções de Deploy

### Opção 1: Azure Web App (Recomendado)

1. **Extrair o pacote ZIP**
   ```bash
   unzip vendara-production-workspace-20260304-205620.zip -d /home/site/wwwroot
   ```

2. **Verificar arquivo web.config**
   - Redirecionar todas rotas para index.html (SPA)
   - Configurar cache de assets estáticos

### Opção 2: Nginx

1. **Copiar arquivos**
   ```bash
   cp -r dist/vendara/browser/* /var/www/vendara/
   ```

2. **Configurar nginx.conf**
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

### Opção 3: Docker

```bash
docker build -t vendara:1.3.0 .
docker run -p 80:80 vendara:1.3.0
```

---

## ✅ Checklist de Deploy

- [ ] Build de produção concluído com sucesso
- [ ] Pacote ZIP criado e verificado
- [ ] Backend implementou ou planeja implementar `GET /api/workspaces/my`
- [ ] Backend processa header `x-workspace-id` corretamente
- [ ] Endpoint `POST /api/workspaces/{id}/select` funcionando
- [ ] Arquivos extraídos no servidor
- [ ] Servidor web configurado para SPA (redirect para index.html)
- [ ] Teste de acesso ao sistema
- [ ] Verificar login e seleção de workspace
- [ ] Confirmar que roles aparecem (se backend implementado)

---

## 🔄 Compatibilidade

### Retrocompatibilidade
✅ **Totalmente compatível** com backends antigos que não implementaram `/api/workspaces/my`
- Sistema detecta erro 403/404 automaticamente
- Faz fallback para endpoint `/api/workspaces`
- Roles não aparecem (comportamento anterior mantido)

### Quando implementar no Backend
Quando o backend implementar `GET /api/workspaces/my` retornando roles:
- Sistema automaticamente começa a usar o novo endpoint
- Badges de roles aparecem na interface
- Nenhuma mudança necessária no frontend

---

## 📝 Notas Técnicas

### WorkspaceService
- Método `getMyWorkspaces()` com fallback automático
- Métodos `list()` e `getWorkspaces()` redirecionam para novo endpoint
- Preserva role ao normalizar workspaces

### WorkspaceInterceptor
- Adiciona `x-workspace-id` em todas chamadas `/api/*`
- Prioridade: localStorage → sessionStorage → Service
- Logs detalhados para debug

### WorkspaceGuard
- Valida workspace antes de acessar rotas protegidas
- Redireciona para `/workspace/select` se não houver workspace
- Sincroniza com backend via `POST /api/workspaces/{id}/select`

---

## 🐛 Troubleshooting

### Erro: "Workspace não encontrado"
- Verificar se `x-workspace-id` está sendo enviado
- Confirmar que backend processa o header
- Checar logs do console (detalhados)

### Erro: "Acesso negado ao workspace"
- Verificar permissões do usuário no workspace_users
- Confirmar que role do usuário permite acesso
- Testar endpoint `GET /api/workspaces/my` diretamente

### Fallback não funciona
- Confirmar que endpoint antigo `/api/workspaces` existe
- Verificar logs do console para ver qual endpoint está sendo usado
- Erro 403/404 deve acionar fallback automaticamente

---

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Verificar logs do console do navegador (muito detalhados)
2. Confirmar que backend está implementado conforme especificação
3. Testar endpoints manualmente com Postman/Insomnia

---

**Build finalizado com sucesso! ✅**
