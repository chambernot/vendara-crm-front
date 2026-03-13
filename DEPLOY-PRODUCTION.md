# Vendara - Pacote de Produção v1.2

## 📦 Build Gerado com Sucesso

**Data do Build:** 02 de Março de 2026  
**Versão:** 1.2.0  
**Tempo de Build:** 23.785 segundos  
**Ambiente:** Production (Otimizado)  
**Pacote ZIP:** vendara-production-20260302-212945.zip (0.33 MB)

---

## 🔧 Configurações de Produção

**API Backend:** `https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api`  
**Modo:** `production: true`  
**Seed Data:** `enableSeedData: false`

---

## 📁 Estrutura do Pacote

```
dist/vendara/
├── browser/              # Arquivos estáticos para deploy
│   ├── index.html       # Ponto de entrada da aplicação
│   ├── styles-*.css     # Estilos otimizados e minificados
│   ├── main-*.js        # JavaScript principal da aplicação
│   ├── polyfills-*.js   # Polyfills para compatibilidade
│   ├── chunk-*.js       # Chunks lazy-loaded (60 arquivos)
│   └── favicon.ico      # Ícone da aplicação
├── 3rdpartylicenses.txt # Licenças de bibliotecas de terceiros
└── prerendered-routes.json
```

---

## 📊 Estatísticas do Build

### Arquivos Iniciais (Carregados na primeira visita)
- **Total:** 521.60 kB (135.75 kB comprimido)
- **Principais arquivos:**
  - `chunk-DX7JZT3V.js`: 314.46 kB (87.40 kB comprimido)
  - `styles-UU652CSP.css`: 65.28 kB (8.01 kB comprimido)
  - `chunk-7HBQJXUR.js`: 57.48 kB (13.78 kB comprimido)
  - `polyfills-B6TNHZQ6.js`: 34.58 kB (11.32 kB comprimido)
  - `chunk-2ULYIWUY.js`: 22.50 kB (5.60 kB comprimido)
  - `main-ZTMMMRBY.js`: 11.50 kB (3.76 kB comprimido)

### Lazy Chunks (Carregados sob demanda)
- **60 arquivos** otimizados com code-splitting
- Principais páginas:
  - Central de Follow-ups: 76.27 kB (17.02 kB comprimido)
  - Detalhes do Cliente: 51.26 kB (12.16 kB comprimido)
  - Thread de Mensagens: 27.55 kB (7.42 kB comprimido)
  - Catálogo: 24.21 kB (6.54 kB comprimido)
  - Dashboard: 13.78 kB (4.46 kB comprimido)
  - Workspace: 13.59 kB (3.76 kB comprimido)

---

## 🚀 Instruções de Deploy

### Opção 1: Servidor Estático (Recomendado)

#### Deploy em Nginx
```nginx
server {
    listen 80;
    server_name vendara.seudominio.com;
    root /var/www/vendara;
    index index.html;

    # Redirecionar todas as rotas para index.html (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Compressão gzip
    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

**Passos:**
1. Copie o conteúdo de `dist/vendara/browser/` para `/var/www/vendara`
2. Configure o arquivo nginx acima
3. Reinicie o Nginx: `sudo systemctl reload nginx`

---

#### Deploy em Apache
```apache
<VirtualHost *:80>
    ServerName vendara.seudominio.com
    DocumentRoot /var/www/vendara

    <Directory /var/www/vendara>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # Rewrite para SPA
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Cache
    <FilesMatch "\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        Header set Cache-Control "max-age=31536000, public, immutable"
    </FilesMatch>
</VirtualHost>
```

**Passos:**
1. Copie o conteúdo de `dist/vendara/browser/` para `/var/www/vendara`
2. Ative mod_rewrite: `sudo a2enmod rewrite`
3. Configure o VirtualHost acima
4. Reinicie o Apache: `sudo systemctl reload apache2`

---

### Opção 2: Serviços de Hospedagem Cloud

#### Vercel
```bash
# Instale o Vercel CLI
npm i -g vercel

# Deploy
cd dist/vendara/browser
vercel --prod
```

#### Netlify
```bash
# Instale o Netlify CLI
npm i -g netlify-cli

# Deploy
cd dist/vendara/browser
netlify deploy --prod --dir .
```

**Arquivo `netlify.toml` (opcional):**
```toml
[build]
  publish = "dist/vendara/browser"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Firebase Hosting
```bash
# Instale o Firebase CLI
npm i -g firebase-tools

# Faça login
firebase login

# Inicialize
firebase init hosting

# Configure:
# - Public directory: dist/vendara/browser
# - Single-page app: Yes
# - Overwrite index.html: No

# Deploy
firebase deploy --only hosting
```

---

### Opção 3: Docker

**Dockerfile:**
```dockerfile
FROM nginx:alpine

# Copiar arquivos da aplicação
COPY dist/vendara/browser /usr/share/nginx/html

# Configuração customizada do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**nginx.conf:**
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

**Comandos:**
```bash
# Build da imagem
docker build -t vendara:latest .

# Executar container
docker run -d -p 80:80 vendara:latest

# Ou com docker-compose
```

**docker-compose.yml:**
```yaml
version: '3.8'
services:
  vendara:
    build: .
    ports:
      - "80:80"
    restart: unless-stopped
```

---

## ⚙️ Variáveis de Ambiente

Antes do deploy, configure as variáveis de ambiente no arquivo `src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.vendara.com',  // URL da sua API
  whatsappApiUrl: 'https://whatsapp-api.vendara.com',
  version: '1.0.0'
};
```

**Importante:** Se você alterar as variáveis de ambiente, execute `npm run build:prod` novamente.

---

## 🔒 Checklist de Segurança

- [ ] HTTPS configurado (SSL/TLS)
- [ ] Headers de segurança configurados:
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "no-referrer-when-downgrade" always;
  ```
- [ ] CORS configurado no backend
- [ ] Rate limiting configurado
- [ ] Backup configurado

---

## 🎯 Otimizações Aplicadas

✅ **Minificação:** Todo JavaScript e CSS foi minificado  
✅ **Tree-shaking:** Código não utilizado foi removido  
✅ **Code-splitting:** 60 chunks para carregamento sob demanda  
✅ **Lazy loading:** Rotas carregadas apenas quando necessárias  
✅ **AOT Compilation:** Ahead-of-Time compilation ativada  
✅ **Build Optimizer:** Otimizações do Angular ativadas  
✅ **Source Maps:** Removidos da produção  
✅ **Idle Timeout:** Expiração automática de sessão após 15 minutos de inatividade  

---

## 📱 Compatibilidade

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

---

## 📈 Performance

### Métricas Estimadas
- **First Contentful Paint (FCP):** < 1.5s
- **Largest Contentful Paint (LCP):** < 2.5s
- **Time to Interactive (TTI):** < 3.5s
- **Total Bundle Size (Initial):** 128.22 kB (comprimido)

### Recomendações Adicionais
1. Configure CDN (CloudFront, Cloudflare) para melhor performance global
2. Ative compressão Brotli no servidor (ainda melhor que gzip)
3. Configure HTTP/2 para multiplexing
4. Use preconnect para APIs externas
5. Configure cache de longo prazo para assets

---

## 🐛 Troubleshooting

### Página em branco após deploy
- Verifique se o servidor está redirecionando todas as rotas para `index.html`
- Verifique o console do browser para erros
- Verifique se os caminhos dos assets estão corretos

### Erro 404 ao recarregar página
- Configure rewrite rules no servidor (veja exemplos acima)
- Para SPAs, todas as rotas devem apontar para `index.html`

### CSS não está sendo aplicado
- Verifique o caminho do arquivo CSS no `index.html`
- Verifique se o servidor está servindo arquivos `.css` com o Content-Type correto

---

## 📞 Suporte

Para problemas de deploy ou dúvidas, consulte:
- Documentação do Angular: https://angular.io/guide/deployment
- Guias de deploy: https://angular.io/guide/deployment#server-configuration

---

## 📝 Changelog

### v1.2.0 (02/03/2026)
- 🔒 **Expiração de Sessão por Inatividade:** Sistema monitora 15 minutos de inatividade
- ⚠️ **Modal de Aviso:** Alerta 2 minutos antes da expiração (countdown de 120 segundos)
- 🔐 **Auto-logout:** Logout automático e redirecionamento para login com mensagem
- 📊 **Dashboard Inteligente:** Ranking por score (quem compra hoje)
- 💬 **Auto-completar Follow-ups:** Follow-ups abertos completados ao enviar mensagem
- 📱 **Botão WhatsApp:** Integração funcional com wa.me

### v1.1.0 (25/02/2026)
- 🎯 **SCORE System:** Implementação completa do sistema de pontuação (score, scoreLabel, scoreTier)
- 🔧 **Ambientes:** Configuração dev (localhost:5000) e prod (Azure)
- ⚡ **Backend API:** Integração com API oficial do backend

### v1.0.0 (18/02/2026)
- ✨ Design system moderno implementado
- 🎨 Todas as telas modernizadas (Login, Workspace, Follow-ups, Clientes, Catálogo, Vendas)
- 📱 Responsividade completa (mobile/tablet/desktop)
- ♿ Acessibilidade melhorada (contraste AA, foco visível)
- ⚡ Performance otimizada com lazy loading
- 🔧 Build de produção configurado e testado

---

**Build realizado em:** 02 de Março de 2026  
**Status:** ✅ Pronto para produção  
**Pacote:** vendara-production-20260302-212945.zip
