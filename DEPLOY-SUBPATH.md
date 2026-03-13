# Deploy em Subpath (/joiasia/)

## 📋 Problema Identificado

A aplicação estava sendo servida em `https://hcasistemas.com.br/joiasia/` mas o build foi feito sem o `--base-href` correto, causando:
- ❌ Erros de MIME type (text/html ao invés de text/javascript)
- ❌ Chunks JS não carregam
- ❌ Aplicação não funciona

## ✅ Solução

### 1. Build com base-href correto

```powershell
ng build --base-href=/joiasia/
```

Isso gera o build em `dist/vendara/browser/` com o `<base href="/joiasia/">` correto no index.html.

### 2. Configuração do Nginx

Use a configuração em `nginx-subpath.conf`:

```nginx
location /joiasia/ {
    alias /var/www/html/joiasia/;
    try_files $uri $uri/ /joiasia/index.html;
    index index.html;
}
```

**Importante:** Use `alias` e não `root` para subpaths!

### 3. Deploy dos arquivos

**Copiar arquivos do build:**

```bash
# No servidor
cd /var/www/html/joiasia/

# Limpar arquivos antigos
rm -rf *

# Copiar novos arquivos (do diretório dist/vendara/browser/)
# Via SCP:
scp -r dist/vendara/browser/* usuario@hcasistemas.com.br:/var/www/html/joiasia/

# Via FTP ou painel de controle:
# Upload todo o conteúdo de dist/vendara/browser/ para /var/www/html/joiasia/
```

### 4. Aplicar configuração Nginx

```bash
# Copiar configuração
sudo cp nginx-subpath.conf /etc/nginx/sites-available/hcasistemas

# Criar link simbólico
sudo ln -sf /etc/nginx/sites-available/hcasistemas /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Recarregar nginx
sudo systemctl reload nginx
```

### 5. Verificar permissões

```bash
# Garantir que o nginx pode ler os arquivos
sudo chown -R www-data:www-data /var/www/html/joiasia/
sudo chmod -R 755 /var/www/html/joiasia/
```

## 🔍 Verificação

Após deploy, acesse:
- **Vitrine pública:** https://hcasistemas.com.br/joiasia/vitrine/testeambiente
- **Login admin:** https://hcasistemas.com.br/joiasia/auth/login

**No console do navegador (F12):**
- ✅ Não deve haver erros de MIME type
- ✅ Todos os chunks .js devem carregar corretamente
- ✅ Status 200 para todos os recursos

## 📝 Estrutura de Arquivos no Servidor

```
/var/www/html/joiasia/
├── index.html                    (com <base href="/joiasia/">)
├── styles-DKXQXOYZ.css
├── chunk-*.js
├── main-*.js
├── polyfills-*.js
└── ... (outros arquivos do build)
```

## 🚨 Troubleshooting

### Problema: Erro 404 ao acessar rotas
**Solução:** Verificar `try_files` no nginx:
```nginx
try_files $uri $uri/ /joiasia/index.html;
```

### Problema: MIME type incorreto
**Solução:** Verificar se `include /etc/nginx/mime.types;` está no nginx.conf

### Problema: Arquivos não carregam (404)
**Solução:** Verificar permissões:
```bash
ls -la /var/www/html/joiasia/
# Deve mostrar www-data como owner
```

### Problema: Rota funciona mas recursos não carregam
**Solução:** Verificar base-href no index.html:
```bash
grep "base href" /var/www/html/joiasia/index.html
# Deve retornar: <base href="/joiasia/">
```

## 📦 Script de Deploy Rápido

```bash
#!/bin/bash
# deploy-subpath.sh

echo "🚀 Iniciando deploy em subpath..."

# Build local
echo "📦 Fazendo build..."
ng build --base-href=/joiasia/

# Upload (ajuste credenciais)
echo "📤 Enviando arquivos..."
scp -r dist/vendara/browser/* usuario@hcasistemas.com.br:/var/www/html/joiasia/

# Ajustar permissões no servidor
echo "🔧 Ajustando permissões..."
ssh usuario@hcasistemas.com.br "sudo chown -R www-data:www-data /var/www/html/joiasia/ && sudo chmod -R 755 /var/www/html/joiasia/"

echo "✅ Deploy concluído!"
echo "🌐 Acesse: https://hcasistemas.com.br/joiasia/"
```

## 🔒 HTTPS (Recomendado)

Se o site já tem SSL configurado, a mesma configuração funcionará em HTTPS automaticamente.

**Verificar SSL:**
```bash
sudo certbot certificates
```

**Renovar SSL (se necessário):**
```bash
sudo certbot renew
```

## 📊 Monitoramento

**Logs do Nginx:**
```bash
# Acompanhar logs em tempo real
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

**Verificar status:**
```bash
# Status do nginx
sudo systemctl status nginx

# Testar configuração
sudo nginx -t
```

---

**Data da última atualização:** 01/03/2026
**Build gerado em:** `dist/vendara/browser/`
**Base href configurado:** `/joiasia/`
