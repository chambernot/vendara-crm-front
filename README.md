# Vendara CRM - Frontend

Sistema CRM multi-tenant para gestão de vendas, clientes e catálogo de produtos.

## 🚀 Tecnologias

- **Angular 19.2** - Framework frontend
- **TypeScript** - Linguagem de programação
- **TailwindCSS** - Framework CSS
- **RxJS** - Programação reativa
- **Standalone Components** - Arquitetura moderna do Angular

## 📋 Funcionalidades

### Multi-Tenant Workspace
- ✅ Suporte a múltiplos workspaces por usuário
- ✅ Roles de acesso (Owner, Admin, Manager, User, Viewer)
- ✅ Seleção automática de workspace único
- ✅ Tela de seleção para múltiplos workspaces
- ✅ Isolamento de dados por workspace

### Módulos Principais
- **Dashboard** - Visão geral e métricas
- **Clientes** - Gestão de clientes com score de engajamento
- **Catálogo** - Produtos, estoque e movimentações
- **Mensagens** - Integração com WhatsApp
- **Vendas** - Controle de vendas e consignações
- **Central** - Templates e follow-ups
- **Relatórios** - Análises e estatísticas

## 🛠️ Como Executar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm start

# Build de produção
npm run build:prod
```

### Configuração

Configure a URL da API em `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000/api',
  apiKey: 'sua-api-key'
};
```

## 📁 Estrutura do Projeto

```
src/app/
├── core/                 # Serviços e funcionalidades core
│   ├── api/             # Cliente HTTP e interceptors
│   ├── auth/            # Autenticação e guards
│   ├── workspace/       # Gestão de workspaces
│   ├── services/        # Serviços globais
│   └── storage/         # Gerenciamento de localStorage
├── features/            # Módulos de funcionalidades
│   ├── auth/           # Login e registro
│   ├── dashboard/      # Dashboard principal
│   ├── clients/        # Gestão de clientes
│   ├── catalog/        # Catálogo de produtos
│   ├── messages/       # Mensagens WhatsApp
│   ├── sales/          # Vendas e consignações
│   ├── central/        # Central de operações
│   └── workspace/      # Seleção de workspace
└── shared/             # Componentes e utilidades compartilhadas
    ├── ui/             # Componentes de UI
    ├── layouts/        # Layouts da aplicação
    └── services/       # Serviços compartilhados
```

## 🔐 Autenticação

O sistema utiliza JWT Bearer tokens com refresh automático. Todos os requests para `/api/*` incluem automaticamente:
- Header `Authorization: Bearer {token}`
- Header `x-workspace-id: {workspaceId}`
- Header `x-api-key: {apiKey}` (em desenvolvimento)

## 📡 API Integration

### Endpoints Principais

```
POST   /auth/login                    # Autenticação
GET    /workspaces/my                 # Workspaces do usuário
POST   /workspaces/{id}/select        # Selecionar workspace
GET    /clients                       # Listar clientes
GET    /products                      # Listar produtos
POST   /messages/send                 # Enviar mensagem
GET    /dashboard/stale-products     # Produtos parados
```

## 🎨 UI/UX

- Design responsivo mobile-first
- Tema personalizado com TailwindCSS
- Componentes reutilizáveis
- Feedback visual de loading e erros
- Navegação intuitiva

## 📦 Deploy

### Build de Produção

```bash
npm run build:prod
```

Os arquivos otimizados estarão em `dist/vendara/browser/`.

### Azure Web App

1. Extrair conteúdo de `dist/vendara/browser/`
2. Configurar `web.config` para SPA
3. Deploy via FTP ou Azure DevOps

### Docker

```bash
docker build -t vendara-crm .
docker run -p 80:80 vendara-crm
```

## 📝 Documentação

- [Deploy Multi-Tenant](DEPLOY-WORKSPACE-MULTITENANT.md)
- [Hotfix Dashboard](HOTFIX-DASHBOARD-PECAS-PARADAS.md)
- [Workspace Flow](WORKSPACE-FLOW-IMPLEMENTATION.md)
- [API Implementation](WORKSPACE-API-IMPLEMENTATION.md)

## 🐛 Troubleshooting

### Erro: "Workspace não encontrado"
- Verificar se header `x-workspace-id` está sendo enviado
- Confirmar que workspace está selecionado
- Limpar localStorage e fazer login novamente

### Erro: "Acesso negado"
- Verificar token JWT válido
- Confirmar permissões do usuário no workspace
- Verificar role do usuário

### Logs detalhados
Abra o console do navegador para ver logs detalhados de todas as operações.

## 🔄 Versionamento

- **v1.0.0** - Release inicial
- **v1.1.0** - Integração WhatsApp
- **v1.2.0** - Sistema de vendas
- **v1.3.0** - Multi-tenant workspace (atual)

## 📄 Licença

Proprietary - Todos os direitos reservados

## 👥 Contato

Para suporte ou dúvidas sobre o projeto, entre em contato com a equipe de desenvolvimento.

---

**Desenvolvido com ❤️ usando Angular**
