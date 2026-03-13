# 📦 Instruções de Deploy - Build Gerado

**Data:** 01/03/2026 18:14  
**Ambiente:** Produção (hcasistemas.com.br/joiasia/)  
**Pacote:** vendara-joiasia-20260301-1814.zip

## ✅ Correções Implementadas

### Problema Identificado
A aplicação estava chamando o endpoint incorreto para a vitrine:
```
❌ https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api/public/catalog/testeambiente
```

**Causa:** O endpoint público no backend é `/public/catalog/`, não `/api/public/catalog/`. O código estava adicionando `/public/catalog` ao `apiBaseUrl` que já incluía `/api` no final.

### Solução Aplicada
1. ✅ Modificado [vitrine-api.service.ts](src/app/features/vitrine/data-access/vitrine-api.service.ts) para remover `/api` do `apiBaseUrl` antes de adicionar `/public/catalog`
2. ✅ Agora a vitrine usa a mesma base URL que os outros endpoints
3. ✅ .htaccess criado com `RewriteBase /joiasia/`
4. ✅ Build gerado com `--configuration production --base-href /joiasia/`
5. ✅ Pacote ZIP criado: **vendara-joiasia-20260301-1814.zip**

### URLs Corretas Agora
- ✅ **Produtos:** `https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api/products`
- ✅ **Vitrine:** `https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/public/catalog/testeambiente`

## 📁 Conteúdo do Pacote

O arquivo `vendara-joiasia-20260301-1814.zip` (0.32 MB) contém:
- ✅ index.html com `<base href="/joiasia/">`
- ✅ .htaccess com `RewriteBase /joiasia/`
- ✅ 69 arquivos JavaScript otimizados
- ✅ Arquivos CSS otimizados
- ✅ Todos os assets necessários
- ✅ Vitrine configurada para usar `/public/catalog` (sem `/api`)

## 🚀 Passos para Deploy

### 1. Acesso ao Servidor
Conecte-se via FTP/SFTP ao servidor hcasistemas.com.br

### 2. Backup (Recomendado)
Antes de fazer o deploy, faça backup da pasta `/joiasia/` atual

### 3. Limpar Pasta de Destino
**IMPORTANTE:** Apague TODO o conteúdo da pasta `/joiasia/` no servidor:
- Todos os arquivos `.js` antigos
- Todos os arquivos `.css` antigos
- O `index.html` antigo
- O `.htaccess` antigo (se existir)

**NÃO** apague a pasta `/joiasia/` em si, apenas o conteúdo.

### 4. Upload dos Novos Arquivos
1. Extraia o conteúdo do ZIP `vendara-joiasia-20260301-1814.zip`
2. Faça upload de **TODOS** os arquivos para `/joiasia/`

**Estrutura esperada no servidor:**
```
/joiasia/
├── index.html
├── .htaccess                    ⚠️ CRÍTICO!
├── favicon.ico
├── styles-THZSAE7R.css
├── polyfills-B6TNHZQ6.js
├── main-T7XKBEYW.js
├── chunk-*.js (69 arquivos)
└── (outros arquivos)
```

### 5. Verificar Permissões
O arquivo `.htaccess` deve ter permissão **644** (rw-r--r--)

### 6. Verificar .htaccess
Confirme que o `.htaccess` foi enviado corretamente.  
**Nota:** Alguns clientes FTP não mostram arquivos começando com `.` por padrão.

No FileZilla: Ver > Mostrar arquivos ocultos

## 🧪 Testar Após Deploy

### 1. Limpar Cache do Navegador
- Chrome: Ctrl + Shift + Del > Limpar dados
- Ou usar janela anônima (Ctrl + Shift + N)

### 2. Acessar Login
```
https://hcasistemas.com.br/joiasia/auth/login
```

### 3. Verificar Console (F12)
- ✅ JavaScript deve carregar como `application/javascript`
- ✅ Não deve aparecer erros de "Failed to load module script"
- ❌ Se aparecer `text/html` = .htaccess não está funcionando

### 4. Testar Vitrine
```
https://hcasistemas.com.br/joiasia/vitrine/testeambiente
```

**Console deve mostrar:**
```
🌐 [Vitrine] URL completa: https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api/public/catalog/testeambiente
```

## 🔍 Verificação da Correção

### API Correta Agora
❌ **ANTES (Errado):**
```
https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api/public/catalog/testeambiente
```

✅ **AGORA (Correto):**
```
https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/public/catalog/testeambiente
```

### Consistência com Outros Endpoints
Agora a vitrine usa a mesma estrutura que os outros endpoints:
- **Produtos:** `https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/api/products`
- **Vitrine:** `https://hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net/public/catalog/{slug}`

A diferença é que `/api/products` é protegido (requer autenticação), enquanto `/public/catalog` é público.

## ⚠️ Solução de Problemas

### Erro: "Failed to load module script"
**Causa:** `.htaccess` não está sendo processado

**Soluções:**
1. Verificar se `.htaccess` foi enviado para o servidor
2. Verificar permissões do arquivo (deve ser 644)
3. Contatar hospedagem e verificar se `AllowOverride All` está habilitado
4. Verificar se `mod_rewrite` está ativo no Apache

### Erro: API não encontrada
**Causa:** Problemas de CORS ou backend offline

**Verificar:**
1. Abrir console do navegador (F12)
2. Verificar se a URL da API está correta (deve apontar para Azure)
3. Testar se o backend Azure está online

### Produtos não carregam
**Verificar:**
1. Console do navegador para erros
2. Se o workspace "testeambiente" existe no backend
3. Se há produtos cadastrados nesse workspace

## 📞 Suporte

Se os problemas persistirem:
1. Verificar logs do Apache no servidor
2. Verificar configuração do virtual host
3. Testar acesso direto aos arquivos .js no navegador

---

**Build gerado em:** 01/03/2026 18:14  
**Comando usado:** `ng build --configuration production --base-href /joiasia/`  
**Ambiente de produção:** Verificado ✅  
**API configurada:** Azure (hcajoaias-b5d7hvb9gpc3a0hg.brazilsouth-01.azurewebsites.net) ✅  
**Endpoint vitrine:** `/public/catalog` (sem `/api`) ✅
