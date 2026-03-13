# 🚀 GUIA DE DEPLOY - HCAJOA IAS CRM

## 📦 Pacote de Produção Gerado

**Data:** ${new Date().toISOString().split('T')[0]}
**Localização:** `dist/hcajoa-ias-crm/browser/`
**Tamanho:** ~1.01 MB (72 arquivos)

---

## ✅ O QUE FOI INCLUÍDO

✔️ **Aplicação Angular compilada e otimizada**
- Minificação de JavaScript e CSS
- Tree-shaking (remoção de código não utilizado)
- Compressão e otimização de assets
- Source maps removidos para produção

✔️ **Arquivos de configuração**
- `web.config` - Para servidores IIS (Azure App Service, Windows Server)
- `.htaccess` - Para servidores Apache (Linux)

✔️ **Segurança**
- Headers de segurança configurados
- Redirecionamento HTTPS
- Proteção XSS e clickjacking

---

## 🌐 OPÇÕES DE DEPLOY

### 1️⃣ **AZURE APP SERVICE (Recomendado)**

#### Pré-requisitos:
- Conta Azure ativa
- Azure CLI instalado (opcional, mas recomendado)

#### Método A: Via Portal Azure

1. Acesse o [Portal Azure](https://portal.azure.com)
2. Navegue até seu App Service
3. Vá em **Deployment Center**
4. Escolha **Local Git** ou **FTP/Credentials**
5. Faça upload do conteúdo da pasta `dist/hcajoa-ias-crm/browser/`

#### Método B: Via Azure CLI

\`\`\`powershell
# Login no Azure
az login

# Fazer deploy
az webapp up --name <seu-app-name> --resource-group <seu-resource-group> --src dist/hcajoa-ias-crm/browser
\`\`\`

#### Método C: Via FTP

1. No Portal Azure, vá em **Deployment Center > FTP Credentials**
2. Copie as credenciais FTP
3. Use um cliente FTP (FileZilla, WinSCP, etc.)
4. Conecte-se ao servidor
5. Faça upload de todo o conteúdo de `browser/` para `/site/wwwroot/`

**⚠️ IMPORTANTE:** O arquivo `web.config` já está incluído no pacote!

---

### 2️⃣ **AZURE STATIC WEB APPS**

\`\`\`powershell
# Usando Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Deploy
swa deploy ./dist/hcajoa-ias-crm/browser --env production
\`\`\`

---

### 3️⃣ **NGINX (Linux/VPS)**

1. **Copiar arquivos para o servidor:**
\`\`\`bash
scp -r dist/hcajoa-ias-crm/browser/* user@seu-servidor:/var/www/hcajoa-crm/
\`\`\`

2. **Configurar NGINX:**
Crie `/etc/nginx/sites-available/hcajoa-crm`:

\`\`\`nginx
server {
    listen 80;
    listen [::]:80;
    server_name seu-dominio.com;
    
    # Redirecionar para HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name seu-dominio.com;
    
    # Certificado SSL (use Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/seu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seu-dominio.com/privkey.pem;
    
    root /var/www/hcajoa-crm;
    index index.html;
    
    # Compressão GZIP
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Cache para assets
    location ~* \\.(?:css|js|jpg|jpeg|gif|png|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Angular SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy para API (se necessário)
    location /api/ {
        proxy_pass https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
\`\`\`

3. **Ativar site:**
\`\`\`bash
sudo ln -s /etc/nginx/sites-available/hcajoa-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
\`\`\`

---

### 4️⃣ **APACHE (Linux/Windows)**

O arquivo `.htaccess` já está incluído no pacote!

1. Copie todo o conteúdo de `browser/` para o diretório do Apache
2. Certifique-se de que `mod_rewrite` está habilitado:
\`\`\`bash
sudo a2enmod rewrite
sudo systemctl reload apache2
\`\`\`

---

## 🔧 CONFIGURAÇÕES IMPORTANTES

### Variáveis de Ambiente de Produção

O arquivo `environment.prod.ts` está configurado com:

\`\`\`typescript
export const environment = {
  production: true,
  enableSeedData: false,
  apiBaseUrl: 'https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api',
  apiKey: '', // Configure via variável de ambiente
  whatsappApiKey: '' // Configure via variável de ambiente
};
\`\`\`

**⚠️ ATENÇÃO:** 
- As `apiKey` e `whatsappApiKey` devem ser configuradas no servidor
- **NUNCA** commite chaves de API no código fonte

### Configuração de API Keys no Azure

1. Vá em **Configuration > Application settings**
2. Adicione:
   - `HCAJOA_API_KEY`: sua chave de API
   - `WHATSAPP_API_KEY`: sua chave do WhatsApp

---

## 🧪 TESTE LOCAL DO BUILD DE PRODUÇÃO

Para testar o build localmente antes do deploy:

\`\`\`powershell
# Instalar servidor HTTP simples
npm install -g http-server

# Servir a aplicação
cd dist/hcajoa-ias-crm/browser
http-server -p 8080 -c-1

# Abrir no navegador: http://localhost:8080
\`\`\`

---

## 📊 PERFORMANCE

### Métricas do Build

- **Tamanho inicial:** 473.85 KB raw / 126.46 KB comprimido
- **Lazy loading:** 57 chunks carregados sob demanda
- **Build time:** ~19.5 segundos
- **Total de chunks:** 72 arquivos

### Otimizações Aplicadas

✅ **Code Splitting** - Lazy loading de rotas
✅ **Tree Shaking** - Remoção de código não utilizado  
✅ **Minificação** - JavaScript e CSS minificados
✅ **Compression** - GZIP habilitado
✅ **Cache Busting** - Hash nos nomes dos arquivos
✅ **Asset Optimization** - Imagens e fontes otimizadas

---

## 🔒 SEGURANÇA

Headers configurados nos arquivos de configuração:

- `X-Content-Type-Options: nosniff` - Previne MIME sniffing
- `X-Frame-Options: SAMEORIGIN` - Previne clickjacking
- `X-XSS-Protection: 1; mode=block` - Proteção XSS
- `Referrer-Policy: strict-origin-when-cross-origin` - Controla referrer

---

## 📝 CHECKLIST PRÉ-DEPLOY

- [ ] Build de produção concluído sem erros
- [ ] Variáveis de ambiente configuradas
- [ ] API Keys configuradas (não commitadas)
- [ ] Certificado SSL configurado
- [ ] Backend API acessível e funcionando
- [ ] CORS configurado no backend
- [ ] Domínio DNS configurado (se aplicável)
- [ ] Backup do build anterior (se existir)

---

## 🆘 TROUBLESHOOTING

### Erro: "Blank page" após deploy

**Causa:** Roteamento do Angular não configurado corretamente
**Solução:** Verifique se o `web.config` ou `.htaccess` está presente

### Erro 404 ao recarregar página

**Causa:** Servidor não está redirecionando para index.html
**Solução:** Verifique a configuração de rewrite rules

### API não responde

**Causa:** CORS ou API URL incorreta
**Solução:** 
1. Verifique `environment.prod.ts`
2. Configure CORS no backend para aceitar o domínio do frontend

### Headers não são enviados para API

**Causa:** Interceptors podem não estar funcionando
**Solução:**
1. Verifique se `workspaceInterceptor` e `authInterceptor` estão registrados
2. Veja os logs do navegador (Network tab)

---

## 📞 SUPORTE

Para issues e dúvidas:
- Verifique os logs do servidor
- Inspecione o Console do navegador (F12)
- Verifique a aba Network para requests falhando

---

## ✨ PRÓXIMOS PASSOS

Após o deploy bem-sucedido:

1. Configure monitoramento (Application Insights no Azure)
2. Configure backups automáticos
3. Configure CI/CD para deploys automáticos
4. Teste todas as funcionalidades em produção
5. Configure domínio customizado

---

**Build gerado com sucesso! 🎉**
**Pronto para deploy em produção! 🚀**
