# 🚀 Vendara - Pacote de Produção Pronto!

## ✅ Status: **PRONTO PARA DEPLOY**

---

## 📦 Conteúdo do Pacote

### Arquivos de Build
- **Localização:** `dist/vendara/browser/`
- **Total de arquivos:** 67 arquivos
- **Tamanho total:** ~1.2 MB (sem compressão)
- **Tamanho estimado com gzip:** ~130 KB (inicial)

### Arquivos de Configuração Incluídos
✅ `nginx.conf` - Configuração para Nginx  
✅ `.htaccess` - Configuração para Apache  
✅ `Dockerfile` - Build Docker  
✅ `docker-compose.yml` - Orquestração Docker  
✅ `docker-nginx.conf` - Config Nginx para container  
✅ `.dockerignore` - Exclusões Docker  
✅ `deploy.sh` - Script automático Linux/Mac  
✅ `deploy.ps1` - Script automático Windows  
✅ `DEPLOY-PRODUCTION.md` - Documentação completa  

---

## 🎯 Opções de Deploy (Escolha uma)

### 1️⃣ Servidor Local (Mais Rápido)

**Windows:**
```powershell
.\deploy.ps1
# Escolha opção 1 e informe o caminho do servidor
```

**Linux/Mac:**
```bash
chmod +x deploy.sh
./deploy.sh
# Escolha opção 1 e informe o caminho do servidor
```

---

### 2️⃣ Upload Manual

**Passo 1:** Compactar arquivos
```powershell
# Windows
.\deploy.ps1
# Escolha opção 2 (cria arquivo ZIP)
```

**Passo 2:** Fazer upload do ZIP para seu servidor

**Passo 3:** Descompactar no servidor
```bash
unzip vendara-production-*.zip -d /var/www/vendara
```

**Passo 4:** Configurar servidor web (ver seção abaixo)

---

### 3️⃣ Docker (Recomendado para Produção)

```bash
# Build da imagem
docker build -t vendara:latest .

# Executar com docker-compose
docker-compose up -d

# Ou executar diretamente
docker run -d -p 80:80 --name vendara vendara:latest
```

Acesse: http://localhost

---

### 4️⃣ Hospedagem Cloud

#### **Vercel** (Mais fácil)
```bash
npm i -g vercel
cd dist/vendara/browser
vercel --prod
```

#### **Netlify**
```bash
npm i -g netlify-cli
cd dist/vendara/browser
netlify deploy --prod --dir .
```

#### **Firebase**
```bash
npm i -g firebase-tools
firebase login
firebase init hosting
# Public directory: dist/vendara/browser
# Single-page app: Yes
firebase deploy --only hosting
```

---

## ⚙️ Configuração do Servidor Web

### Para Nginx (Servidor Linux)

**1. Copie os arquivos:**
```bash
sudo cp -r dist/vendara/browser/* /var/www/vendara/
```

**2. Copie a configuração:**
```bash
sudo cp nginx.conf /etc/nginx/sites-available/vendara
sudo ln -s /etc/nginx/sites-available/vendara /etc/nginx/sites-enabled/
```

**3. Teste e reinicie:**
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

### Para Apache (Servidor Linux/Windows)

**1. Copie os arquivos:**
```bash
# Linux
sudo cp -r dist/vendara/browser/* /var/www/html/vendara/
sudo cp .htaccess /var/www/html/vendara/

# Windows (IIS/XAMPP/WAMP)
# Copiar para C:\inetpub\wwwroot\vendara\
# ou C:\xampp\htdocs\vendara\
```

**2. Ative mod_rewrite:**
```bash
sudo a2enmod rewrite
sudo systemctl reload apache2
```

O arquivo `.htaccess` já está incluído e configurado!

---

### Para IIS (Windows Server)

**1. Instalar URL Rewrite Module**
- Download: https://www.iis.net/downloads/microsoft/url-rewrite

**2. Criar web.config:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Angular Routes" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

**3. Copiar arquivos para:**
```
C:\inetpub\wwwroot\vendara\
```

---

## 🔐 Checklist de Produção

Antes de colocar no ar, verifique:

- [ ] **HTTPS/SSL configurado** (Let's Encrypt gratuito)
- [ ] **Domínio configurado** (DNS apontando para servidor)
- [ ] **Firewall configurado** (portas 80 e 443 abertas)
- [ ] **Backup configurado**
- [ ] **Monitoramento ativo** (uptime, erros)
- [ ] **Headers de segurança** (já incluídos nos configs)
- [ ] **Compressão ativada** (gzip/brotli)
- [ ] **CDN configurado** (opcional, mas recomendado)

---

## 🌐 Variáveis de Ambiente

**IMPORTANTE:** Se sua API está em outro domínio, edite antes do build:

**Arquivo:** `src/environments/environment.prod.ts`

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.seudominio.com',  // ← Altere aqui
  whatsappApiUrl: 'https://whatsapp-api.seudominio.com',
  version: '1.0.0'
};
```

Após alterar, execute novamente:
```bash
npm run build:prod
```

---

## 🧪 Testar Localmente

Antes de fazer deploy, teste localmente:

**Opção 1: http-server (Node.js)**
```bash
npm install -g http-server
cd dist/vendara/browser
http-server -p 8080 -c-1
```

Acesse: http://localhost:8080

**Opção 2: Python**
```bash
cd dist/vendara/browser
python -m http.server 8080
```

**Opção 3: Docker**
```bash
docker-compose up
```

Acesse: http://localhost

---

## 📊 Performance Esperada

Com as otimizações aplicadas:

- ✅ **First Contentful Paint:** < 1.5s
- ✅ **Largest Contentful Paint:** < 2.5s
- ✅ **Time to Interactive:** < 3.5s
- ✅ **Bundle inicial:** 128 KB (gzip)
- ✅ **Lighthouse Score:** 90+ (100 possível)

---

## 🆘 Problemas Comuns

### Página em branco ao acessar
- ✅ Verificar console do navegador (F12)
- ✅ Verificar se servidor está redirecionando rotas para index.html
- ✅ Verificar se arquivos foram copiados corretamente

### Erro 404 ao recarregar página
- ✅ Configurar rewrite rules (nginx.conf ou .htaccess já incluídos)
- ✅ Verificar se mod_rewrite está ativo (Apache)

### CSS não está carregando
- ✅ Verificar caminho do arquivo no index.html
- ✅ Verificar Content-Type do servidor

---

## 📞 Recursos Adicionais

- **Documentação completa:** `DEPLOY-PRODUCTION.md`
- **Configuração Nginx:** `nginx.conf`
- **Configuração Apache:** `.htaccess`
- **Docker:** `Dockerfile` e `docker-compose.yml`

---

## 🎉 Pronto para Produção!

Seu sistema Vendara está **100% pronto** para produção com:

✨ Visual moderno e responsivo  
⚡ Performance otimizada  
🔒 Segurança configurada  
📱 Mobile-first design  
♿ Acessibilidade AA  
🚀 Deploy facilitado  

**Escolha uma opção de deploy acima e coloque no ar!**

---

**Build gerado em:** 18 de Fevereiro de 2026  
**Versão:** 1.0.0  
**Status:** ✅ PRONTO
