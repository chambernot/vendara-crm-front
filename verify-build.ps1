# Script de verificação pré-deploy
Write-Host "🔍 Verificando build antes do deploy..." -ForegroundColor Cyan

$buildPath = "dist\vendara\browser"
$errors = @()
$warnings = @()

# 1. Verificar se a pasta existe
if (-not (Test-Path $buildPath)) {
    Write-Host "❌ Pasta de build não encontrada: $buildPath" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Pasta de build encontrada" -ForegroundColor Green

# 2. Verificar index.html e base href
$indexPath = Join-Path $buildPath "index.html"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw
    if ($indexContent -match '<base href="/joiasia/">') {
        Write-Host "✅ index.html com base href correto: /joiasia/" -ForegroundColor Green
    } else {
        $errors += "index.html NÃO tem base href='/joiasia/'"
        Write-Host "❌ index.html sem base href correto!" -ForegroundColor Red
    }
} else {
    $errors += "index.html não encontrado"
}

# 3. Verificar .htaccess
$htaccessPath = Join-Path $buildPath ".htaccess"
if (Test-Path $htaccessPath) {
    Write-Host "✅ .htaccess encontrado" -ForegroundColor Green
    
    $htaccessContent = Get-Content $htaccessPath -Raw
    if ($htaccessContent -match 'RewriteBase /joiasia/') {
        Write-Host "✅ .htaccess com RewriteBase correto: /joiasia/" -ForegroundColor Green
    } else {
        $errors += ".htaccess NÃO tem RewriteBase /joiasia/"
        Write-Host "❌ .htaccess sem RewriteBase correto!" -ForegroundColor Red
        Write-Host "   Conteúdo atual:" -ForegroundColor Yellow
        $htaccessContent -split "`n" | Select-Object -First 10 | ForEach-Object {
            Write-Host "   $_" -ForegroundColor Yellow
        }
    }
} else {
    $errors += ".htaccess não encontrado"
    Write-Host "❌ .htaccess NÃO encontrado!" -ForegroundColor Red
}

# 4. Verificar arquivos JavaScript
$jsFiles = Get-ChildItem -Path $buildPath -Filter "*.js" -File
$jsCount = ($jsFiles | Measure-Object).Count

if ($jsCount -gt 60) {
    Write-Host "✅ Encontrados $jsCount arquivos JavaScript" -ForegroundColor Green
} else {
    $warnings += "Apenas $jsCount arquivos .js encontrados (esperado 70+)"
    Write-Host "⚠️  Apenas $jsCount arquivos .js (esperado 70+)" -ForegroundColor Yellow
}

# 5. Verificar arquivos CSS
$cssFiles = Get-ChildItem -Path $buildPath -Filter "*.css" -File
$cssCount = ($cssFiles | Measure-Object).Count

if ($cssCount -gt 0) {
    Write-Host "✅ Encontrados $cssCount arquivos CSS" -ForegroundColor Green
    $cssFiles | ForEach-Object {
        Write-Host "   - $($_.Name)" -ForegroundColor Gray
    }
} else {
    $errors += "Nenhum arquivo CSS encontrado"
}

# 6. Listar arquivos principais
Write-Host "`n📦 Arquivos principais a fazer upload:" -ForegroundColor Cyan
$mainFiles = @("index.html", ".htaccess", "favicon.ico")
foreach ($file in $mainFiles) {
    $filePath = Join-Path $buildPath $file
    if (Test-Path $filePath) {
        $size = (Get-Item $filePath).Length
        Write-Host "   ✅ $file ($size bytes)" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $file (NÃO ENCONTRADO)" -ForegroundColor Red
    }
}

# 7. Resumo
Write-Host "`n================================================================" -ForegroundColor Cyan
Write-Host "RESUMO DA VERIFICACAO" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "✅ Build OK! Pronto para upload." -ForegroundColor Green
    Write-Host "`n📤 Próximos passos:" -ForegroundColor Cyan
    Write-Host "1. Apague TUDO da pasta /joiasia/ no servidor" -ForegroundColor White
    Write-Host "2. Faça upload de TODOS os arquivos de $buildPath" -ForegroundColor White
    Write-Host "3. Confirme que .htaccess foi copiado (pode estar oculto no FTP)" -ForegroundColor White
    Write-Host "4. Limpe o cache do navegador" -ForegroundColor White
    Write-Host "5. Teste: https://hcasistemas.com.br/joiasia/auth/login" -ForegroundColor White
} else {
    Write-Host "❌ Build tem problemas!" -ForegroundColor Red
    
    if ($errors.Count -gt 0) {
        Write-Host "`nERROS CRÍTICOS:" -ForegroundColor Red
        $errors | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "`nAVISOS:" -ForegroundColor Yellow
        $warnings | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    }
    
    Write-Host "`n⚠️  Corrija os erros antes de fazer upload!" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n================================================================" -ForegroundColor Cyan
