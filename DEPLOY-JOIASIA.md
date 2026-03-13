# Deploy para hcasistemas.com.br/joiasia/

## ⚠️ IMPORTANTE - CHECKLIST PRÉ-UPLOAD

1. ✅ Build compilado com `--base-href /joiasia/`
2. ✅ Arquivo `.htaccess` com `RewriteBase /joiasia/`
3. ✅ API configurada para Azure (environment.prod.ts)

## 📁 Arquivos a fazer upload

**Origem:** `C:\Users\chamb\hcajoaIAs-crm\dist\vendara\browser\`

**Destino no servidor:** `/joiasia/` (ou `/public_html/joiasia/` dependendo da estrutura)

## 🚀 Passos para Deploy

### 1. Limpar o servidor
**APAGUE TUDO** dentro da pasta `/joiasia/` no servidor:
- Todos os arquivos `.js`
- Todos os arquivos `.css`
- O `index.html` antigo
- O `.htaccess` antigo (se existir)

### 2. Fazer upload dos novos arquivos
Copie **TODOS** os arquivos de `dist\vendara\browser\` para `/joiasia/`:

```
dist/vendara/browser/
├── index.html                    ⬆️ UPLOAD
├── .htaccess                     ⬆️ UPLOAD (CRÍTICO!)
├── favicon.ico                   ⬆️ UPLOAD
├── styles-THZSAE7R.css          ⬆️ UPLOAD
├── polyfills-B6TNHZQ6.js        ⬆️ UPLOAD
├── main-T7XKBEYW.js             ⬆️ UPLOAD
├── chunk-*.js (70 arquivos)     ⬆️ UPLOAD TODOS
└── media/ (se existir)          ⬆️ UPLOAD
```

### 3. Verificar .htaccess no servidor

**CRÍTICO:** Após o upload, confirme que o `.htaccess` contém:

```apache
RewriteBase /joiasia/
```

**NÃO PODE SER:**
```apache
RewriteBase /
```

### 4. Verificar permissões

O arquivo `.htaccess` precisa ter permissão **644** (rw-r--r--)

### 5. Verificar configuração Apache (se tiver acesso)

O Apache precisa ter:
```apache
<Directory "/var/www/html/joiasia">
    AllowOverride All
</Directory>
```

Se `AllowOverride` estiver como `None`, o `.htaccess` será ignorado!

## 🧪 Testar após deploy

1. **Limpar cache do navegador:**
   - Chrome: Ctrl + Shift + Del > Limpar dados
   - Ou usar janela anônima

2. **Acessar login:**
   https://hcasistemas.com.br/joiasia/auth/login

3. **Verificar console (F12):**
   - ✅ Deve mostrar: JavaScript carregados como `application/javascript`
   - ❌ Se mostrar: `text/html` = .htaccess não está funcionando

4. **Acessar vitrine:**
   https://hcasistemas.com.br/joiasia/vitrine/testeambiente

## 🔍 Solução de Problemas

### Erro: "Failed to load module script... text/html"

**Causa:** `.htaccess` não está sendo processado

**Soluções:**

1. **Confirmar que .htaccess foi copiado:**
   - Acesse via FTP e verifique se o arquivo existe
   - Alguns clientes FTP não mostram arquivos começando com `.`
   - No FileZilla: Ver > Mostrar arquivos ocultos

2. **Verificar RewriteBase:**
   - Deve ser `/joiasia/` (com barras)
   - NÃO deve ser `/`

3. **Contatar hospedagem:**
   - Perguntar: "AllowOverride está habilitado para /joiasia/?"
   - Perguntar: "mod_rewrite está ativo?"

### Erro: Produtos não carregam na vitrine

**Causa:** API não está acessível ou CORS

**Verificar:**
- Console deve mostrar: `https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api/public/catalog/...`
- Se mostrar erro CORS, precisa configurar no backend Azure

## 📝 Checklist Final

- [ ] Todos os 70+ arquivos `.js` foram copiados
- [ ] `index.html` com `<base href="/joiasia/">` foi copiado
- [ ] `.htaccess` com `RewriteBase /joiasia/` foi copiado
- [ ] Cache do navegador foi limpo
- [ ] Login carrega sem erros no console
- [ ] Vitrine carrega produtos do backend

## 🆘 Se ainda não funcionar

Envie screenshot mostrando:
1. Console do navegador (F12 > Console)
2. Aba Network (F12 > Rede) mostrando as requisições
3. Confirmação via FTP de que `.htaccess` existe na pasta
